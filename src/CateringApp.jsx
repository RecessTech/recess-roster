import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus, X, ChevronLeft, ChevronRight, Trash2, Edit2, Loader2, ChevronDown, ChevronUp,
  MapPin, Truck, DollarSign, StickyNote, User, Building2, UtensilsCrossed, Clock, Send,
  Settings, Search, Copy,
} from 'lucide-react';
import { db } from './supabaseClient';
import toast from 'react-hot-toast';

// ── Date helpers ─────────────────────────────────────────────────────────────

function fmtISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function todayStr() { return fmtISO(new Date()); }
function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return fmtISO(d);
}
function dayLabel(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'long' }).toUpperCase();
}
function fmtDateShort(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}
function monthLabel(year, month) {
  return new Date(year, month, 1).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
}
// 42-cell (6 week) grid, Monday-first, for the given month.
function getMonthGrid(year, month) {
  const first = new Date(year, month, 1);
  const startDow = (first.getDay() + 6) % 7; // Mon=0 .. Sun=6
  const gridStart = new Date(year, month, 1 - startDow);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
}
// Total sandwich/wrap pieces to make: platter size (people) × pieces per person.
function computeTotalPieces(platterSize, piecesPerPerson) {
  const p = Number(platterSize);
  const pp = Number(piecesPerPerson);
  if (!p || !pp) return null;
  return Math.round(p * pp);
}
// Splits a whole number of pieces evenly across n menu items, remainder
// going to the first few items -- so the shares always sum back to total.
function distributeEvenly(total, n) {
  if (!total || !n) return Array(n).fill(0);
  const rounded = Math.round(total);
  const base = Math.floor(rounded / n);
  const remainder = rounded - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < remainder ? 1 : 0));
}
function piecesPerUnitFor(packaging) {
  return (PACKAGING_TYPES.find(p => p.key === packaging) || PACKAGING_TYPES[0]).piecesPerUnit;
}
// Converts a menu item's individual pieces into how many rolls/slabs/etc
// to actually make, based on its packaging type.
function computeUnitQty(pieces, packaging) {
  const ppu = piecesPerUnitFor(packaging);
  const n = Number(pieces);
  if (!n || !ppu) return '';
  return Math.round((n / ppu) * 100) / 100;
}
// Same conversion, but against a catering library item's own pieces-per-unit
// ratio (e.g. 3 for a wrap, 16 for a whole focaccia) instead of the generic
// packaging buckets -- used once a menu item row is linked to the library.
function computeUnitQtyForItem(pieces, cateringItem) {
  const ppu = Number(cateringItem?.pieces_per_unit) || 1;
  const n = Number(pieces);
  if (!n || !ppu) return '';
  return Math.round((n / ppu) * 100) / 100;
}

// Walks a job's menu items, and for every one linked to the catering
// library (catering_item_id set), scales that item's own catering recipe
// (catering_item_lines) by how many whole units the job needs, summing
// ingredient/component quantities across every item in the job. Freeform
// items with no library link don't have a recipe, so they can't
// contribute -- the caller decides whether to flag that.
function computeIngredientRollup(jobItems, cateringItemLines, stockItemsById, componentsById) {
  const linesByItem = new Map();
  cateringItemLines.forEach(l => {
    if (!linesByItem.has(l.catering_item_id)) linesByItem.set(l.catering_item_id, []);
    linesByItem.get(l.catering_item_id).push(l);
  });

  const skuTotals = new Map();
  const componentTotals = new Map();

  (jobItems || []).forEach(item => {
    if (!item.catering_item_id) return;
    const unitQty = Number(item.unit_qty) || 0;
    if (!unitQty) return;
    (linesByItem.get(item.catering_item_id) || []).forEach(line => {
      const needed = unitQty * (Number(line.qty) || 0);
      if (!needed) return;
      if (line.stock_item_id) {
        skuTotals.set(line.stock_item_id, (skuTotals.get(line.stock_item_id) || 0) + needed);
      } else if (line.component_id) {
        componentTotals.set(line.component_id, (componentTotals.get(line.component_id) || 0) + needed);
      }
    });
  });

  const prep = [...componentTotals.entries()]
    .map(([id, qty]) => {
      const c = componentsById.get(id);
      return { id, name: c?.name || 'Unknown component', uom: c?.uom || '', qty };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const shoppingByCategory = new Map();
  skuTotals.forEach((qty, id) => {
    const s = stockItemsById.get(id);
    const cat = stockCategoryLabel(s?.category);
    if (!shoppingByCategory.has(cat)) shoppingByCategory.set(cat, []);
    shoppingByCategory.get(cat).push({ id, name: s?.name || 'Unknown item', uom: s?.uom || '', qty });
  });
  shoppingByCategory.forEach(list => list.sort((a, b) => a.name.localeCompare(b.name)));

  const hasUnlinkedItems = (jobItems || []).some(it => trimOrEmpty(it.name) && !it.catering_item_id);

  return {
    prep,
    shoppingByCategory: [...shoppingByCategory.entries()].sort((a, b) => a[0].localeCompare(b[0])),
    hasUnlinkedItems,
  };
}

// ── Constants ────────────────────────────────────────────────────────────────

const TYPE_OPTIONS = ['Breakfast', 'Morning Tea', 'Lunch', 'Afternoon Tea', 'Other'];
// Muted, single-hue-per-type dots -- used as small indicators, never as
// full background fills, so several job types on screen at once stay calm.
const TYPE_DOT = {
  'Breakfast':     '#D97706',
  'Morning Tea':   '#2563EB',
  'Lunch':         '#BE185D',
  'Afternoon Tea': '#7C3AED',
  'Other':         '#64748B',
};
const COMMON_MENU_ITEMS = [
  'Chicken Avo Wrap', 'Recess Club', 'Chickpea Smash', 'BLT', 'Pastrami', 'Curried Egg',
  'Super Green', 'Ham, Cheese & Pickle', 'Big Tuna', 'The Deli', 'The Bella', 'Caesar',
  'Chicken & Greens Salad', 'Veg & Grains Salad', 'Herby Greens Salad',
];

const DEFAULT_PIECES_PER_PERSON = 3.5;

// How many individual pieces make up one "unit" of each packaging style --
// drives the roll/slab quantity calculated from an item's piece count.
const PACKAGING_TYPES = [
  { key: 'none', label: 'Pieces', piecesPerUnit: 1 },
  { key: 'roll',  label: 'Roll',  piecesPerUnit: 3 },
  { key: 'slab',  label: 'Slab',  piecesPerUnit: 20 },
];

const DIETARY_FIELDS = [
  { key: 'gf_ppl',         label: 'GF' },
  { key: 'vego_ppl',       label: 'Vego' },
  { key: 'pb_ppl',         label: 'Plant-Based' },
  { key: 'dairy_free_ppl', label: 'Dairy Free' },
  { key: 'halal_ppl',      label: 'Halal' },
];

const CHECKBOX_FIELDS = [
  { key: 'confirmed',       label: 'Confirmed' },
  { key: 'invoiced',        label: 'Invoiced' },
  { key: 'bread_ordered',   label: 'Bread Ordered' },
  { key: 'delivery_booked', label: 'Delivery Booked' },
];

// Maps a stock_items category code onto the human label used to group the
// per-job "Ingredients Required" shopping list.
const STOCK_CATEGORY_LABELS = {
  PTN: 'Protein', PHF: 'Produce & Fresh Herbs', DRY: 'Dry Goods & Grocery',
  DAI: 'Dairy', BEV: 'Beverage', FZN: 'Frozen', PCK: 'Packaging', SNK: 'Snacks', CLN: 'Cleaning',
};
function stockCategoryLabel(code) {
  return STOCK_CATEGORY_LABELS[code] || code || 'Other';
}

function fmtQty(n) {
  const num = Number(n) || 0;
  return num % 1 === 0 ? String(num) : (Math.round(num * 100) / 100).toString();
}

// ── Shared bits ──────────────────────────────────────────────────────────────

function Modal({ title, onClose, children, maxWidth = 'max-w-lg' }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-2xl shadow-xl w-full ${maxWidth} max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="px-6 py-4 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function SectionLabel({ children }) {
  return <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">{children}</p>;
}

const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300";

// ── Catering platter-item library (the "SamCat" recipe layer) ────────────────
// Each catering_item is a whole catering unit (a wrap, a roll, a whole
// focaccia) with its own catering-specific recipe (catering_item_lines),
// independent of that item's regular in-store recipe in R-Recipe -- a
// catering batch commonly uses a different per-unit quantity. Optionally
// linked to a production_item purely so a new library item can seed its
// recipe by copying the in-store one as a starting point.

function emptyCateringItem() {
  return { name: '', category: '', color: '#94A3B8', pieces_per_unit: 1, unit_label: 'unit', production_item_id: '' };
}

function lineDisplay(line, stockItemsById, componentsById) {
  if (line.stock_item_id) {
    const s = stockItemsById.get(line.stock_item_id);
    return { name: s?.name || 'Unknown SKU', uom: s?.uom || '' };
  }
  const c = componentsById.get(line.component_id);
  return { name: c?.name || 'Unknown component', uom: c?.uom || '' };
}

// Searchable stock-item-or-component combobox for adding a catering recipe line.
function CateringIngredientPicker({ stockItems, components, onPick, onClose }) {
  const [query, setQuery] = useState('');
  const q = query.toLowerCase();
  const skuMatches = stockItems.filter(s => s.active !== false && s.name.toLowerCase().includes(q)).slice(0, 30);
  const componentMatches = components.filter(c => c.active !== false && c.name.toLowerCase().includes(q)).slice(0, 30);

  return (
    <Modal title="Add Ingredient" onClose={onClose} maxWidth="max-w-md">
      <div className="space-y-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search SKUs & components…"
            className="w-full border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
          />
        </div>
        <div className="max-h-80 overflow-y-auto space-y-3">
          {componentMatches.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mb-1">Components</p>
              <div className="bg-gray-50 rounded-xl overflow-hidden divide-y divide-gray-100">
                {componentMatches.map(c => (
                  <button key={c.id} onClick={() => onPick({ kind: 'component', id: c.id })}
                    className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-100 transition-colors">
                    <span className="text-sm font-medium text-gray-900">{c.name}</span>
                    <span className="text-xs text-gray-400">{c.uom}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {skuMatches.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mb-1">SKUs</p>
              <div className="bg-gray-50 rounded-xl overflow-hidden divide-y divide-gray-100">
                {skuMatches.map(s => (
                  <button key={s.id} onClick={() => onPick({ kind: 'sku', id: s.id })}
                    className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-100 transition-colors">
                    <span className="text-sm font-medium text-gray-900">{s.name}</span>
                    <span className="text-xs text-gray-400">{s.uom}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {skuMatches.length === 0 && componentMatches.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">No matches.</p>
          )}
        </div>
      </div>
    </Modal>
  );
}

function CateringLineRow({ line, stockItemsById, componentsById, onQtyChange, onDelete }) {
  const [draft, setDraft] = useState(String(line.qty));
  useEffect(() => { setDraft(String(line.qty)); }, [line.qty]);
  const { name, uom } = lineDisplay(line, stockItemsById, componentsById);

  function commit() {
    const n = parseFloat(draft);
    onQtyChange(isNaN(n) || n < 0 ? 0 : n);
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <span className="flex-1 min-w-0 text-sm font-medium text-gray-900 truncate">{name}</span>
      <input
        type="number" min="0" step="any" value={draft}
        onChange={e => setDraft(e.target.value)}
        onFocus={e => e.target.select()}
        onBlur={commit}
        onKeyDown={e => e.key === 'Enter' && e.target.blur()}
        className="w-20 text-right border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
      />
      <span className="text-xs text-gray-400 w-10">{uom}</span>
      <button onClick={onDelete} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
        <Trash2 size={13} />
      </button>
    </div>
  );
}

// Detail editor for one catering item: its unit conversion + its own
// catering-specific ingredient recipe (independent of the linked menu
// item's regular in-store recipe, if any).
function CateringItemEditor({
  item, orgId, onBack, onRefresh,
  cateringItemLines, stockItems, components, productionItems, recipeMenuItemLines,
}) {
  const [draft, setDraft] = useState({
    name: item.name || '', category: item.category || '', color: item.color || '#94A3B8',
    pieces_per_unit: item.pieces_per_unit ?? 1, unit_label: item.unit_label || 'unit',
    production_item_id: item.production_item_id || '',
  });
  const [showPicker, setShowPicker] = useState(false);
  const [copying, setCopying] = useState(false);
  const isNew = !item.id;

  const stockItemsById = useMemo(() => new Map(stockItems.map(s => [s.id, s])), [stockItems]);
  const componentsById = useMemo(() => new Map(components.map(c => [c.id, c])), [components]);
  const lines = item.id ? cateringItemLines.filter(l => l.catering_item_id === item.id) : [];

  function set(field, value) {
    setDraft(prev => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    const payload = {
      name: draft.name.trim() || 'Untitled item',
      category: draft.category.trim() || null,
      color: draft.color,
      pieces_per_unit: Number(draft.pieces_per_unit) || 1,
      unit_label: draft.unit_label.trim() || 'unit',
      production_item_id: draft.production_item_id || null,
    };
    try {
      if (isNew) {
        const created = await db.createCateringItem(orgId, payload);
        toast.success('Platter item added');
        await onRefresh();
        onBack(created);
      } else {
        await db.updateCateringItem(item.id, payload);
        toast.success('Saved');
        onRefresh();
      }
    } catch (err) {
      toast.error('Failed to save: ' + (err.message || 'unknown error'));
    }
  }

  async function handlePick({ kind, id }) {
    setShowPicker(false);
    try {
      await db.createCateringItemLine(orgId, {
        catering_item_id: item.id,
        stock_item_id: kind === 'sku' ? id : null,
        component_id: kind === 'component' ? id : null,
        qty: 0,
        sort_order: lines.length,
      });
      onRefresh();
    } catch (err) {
      toast.error('Failed to add ingredient: ' + (err.message || 'unknown error'));
    }
  }

  async function handleQtyChange(line, qty) {
    try {
      await db.updateCateringItemLine(line.id, { qty });
      onRefresh();
    } catch (err) {
      toast.error('Failed to update quantity: ' + (err.message || 'unknown error'));
    }
  }

  async function handleDeleteLine(line) {
    try {
      await db.deleteCateringItemLine(line.id);
      onRefresh();
    } catch (err) {
      toast.error('Failed to remove ingredient: ' + (err.message || 'unknown error'));
    }
  }

  // Seeds this item's catering recipe from the linked menu item's regular
  // in-store recipe -- a starting point the admin then adjusts to whatever
  // amount catering actually uses per whole unit, not a live link.
  async function handleCopyFromMenuItem() {
    if (!draft.production_item_id) return;
    const sourceLines = recipeMenuItemLines.filter(l => l.item_id === draft.production_item_id && !l.is_packaging);
    if (sourceLines.length === 0) {
      toast.error('That menu item has no recipe in R-Recipe to copy.');
      return;
    }
    setCopying(true);
    try {
      for (let i = 0; i < sourceLines.length; i++) {
        const src = sourceLines[i];
        await db.createCateringItemLine(orgId, {
          catering_item_id: item.id,
          stock_item_id: src.stock_item_id || null,
          component_id: src.component_id || null,
          qty: src.qty,
          sort_order: lines.length + i,
        });
      }
      toast.success(`Copied ${sourceLines.length} ingredient${sourceLines.length === 1 ? '' : 's'} — adjust quantities for catering below.`);
      onRefresh();
    } catch (err) {
      toast.error('Failed to copy recipe: ' + (err.message || 'unknown error'));
    } finally {
      setCopying(false);
    }
  }

  return (
    <div className="space-y-4">
      <button onClick={() => onBack()} className="text-xs font-semibold text-gray-400 hover:text-gray-600 transition-colors">
        ← Back to library
      </button>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Field label="Name">
            <input value={draft.name} onChange={e => set('name', e.target.value)} onBlur={!isNew ? handleSave : undefined}
              placeholder="e.g. Chicken Avo Wrap" className={inputCls} />
          </Field>
        </div>
        <Field label="Category">
          <input value={draft.category} onChange={e => set('category', e.target.value)} onBlur={!isNew ? handleSave : undefined}
            placeholder="e.g. Sandwiches" className={inputCls} />
        </Field>
        <Field label="Linked Menu Item">
          <select value={draft.production_item_id} onChange={e => { set('production_item_id', e.target.value); if (!isNew) setTimeout(handleSave, 0); }}
            className={inputCls + ' bg-white'}>
            <option value="">— None —</option>
            {productionItems.map(pi => <option key={pi.id} value={pi.id}>{pi.name}</option>)}
          </select>
        </Field>
        <Field label="Pieces per Unit">
          <input type="number" min="0" step="any" value={draft.pieces_per_unit} onChange={e => set('pieces_per_unit', e.target.value)} onBlur={!isNew ? handleSave : undefined}
            className={inputCls} />
        </Field>
        <Field label="Unit Label">
          <input value={draft.unit_label} onChange={e => set('unit_label', e.target.value)} onBlur={!isNew ? handleSave : undefined}
            placeholder="e.g. wrap, roll, focaccia" className={inputCls} />
        </Field>
      </div>

      {isNew ? (
        <button onClick={handleSave} className="w-full text-white rounded-xl py-2 text-sm font-semibold" style={{ background: 'var(--primary)' }}>
          Add Item
        </button>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Catering Recipe (per {draft.unit_label || 'unit'})</p>
            <div className="flex items-center gap-3">
              {draft.production_item_id && (
                <button onClick={handleCopyFromMenuItem} disabled={copying} className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 disabled:opacity-50">
                  <Copy size={13} /> {copying ? 'Copying…' : 'Copy from menu item'}
                </button>
              )}
              <button onClick={() => setShowPicker(true)} className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--primary-dk)' }}>
                <Plus size={13} /> Add Ingredient
              </button>
            </div>
          </div>
          {lines.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6 bg-gray-50 rounded-xl">No ingredients yet.</p>
          ) : (
            <div className="bg-gray-50 rounded-xl divide-y divide-gray-100 overflow-hidden">
              {lines.map(line => (
                <CateringLineRow key={line.id} line={line} stockItemsById={stockItemsById} componentsById={componentsById}
                  onQtyChange={q => handleQtyChange(line, q)} onDelete={() => handleDeleteLine(line)} />
              ))}
            </div>
          )}
        </div>
      )}

      {showPicker && (
        <CateringIngredientPicker stockItems={stockItems} components={components} onPick={handlePick} onClose={() => setShowPicker(false)} />
      )}
    </div>
  );
}

function CateringItemsLibraryModal({ orgId, cateringItems, cateringItemLines, stockItems, components, productionItems, recipeMenuItemLines, onClose, onRefresh }) {
  const [editing, setEditing] = useState(null); // null = list, {} = new, item = edit

  async function handleDelete(item) {
    if (!window.confirm(`Remove "${item.name}" from the platter library? Jobs that already used it keep their saved numbers.`)) return;
    try {
      await db.deleteCateringItem(item.id);
      toast.success('Removed');
      onRefresh();
    } catch (err) {
      toast.error('Failed to remove: ' + (err.message || 'unknown error'));
    }
  }

  return (
    <Modal title="Platter Items Library" onClose={onClose} maxWidth="max-w-xl">
      {editing ? (
        <CateringItemEditor
          item={editing}
          orgId={orgId}
          onBack={(created) => setEditing(created || null)}
          onRefresh={onRefresh}
          cateringItemLines={cateringItemLines}
          stockItems={stockItems}
          components={components}
          productionItems={productionItems}
          recipeMenuItemLines={recipeMenuItemLines}
        />
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-gray-400">Whole catering units (a wrap, a roll, a full focaccia) with their own catering-specific ingredient recipe, used to work out exact quantities needed for a job.</p>
          <button onClick={() => setEditing(emptyCateringItem())} className="w-full flex items-center justify-center gap-1.5 text-sm font-semibold py-2 rounded-xl border border-dashed border-gray-300 text-gray-500 hover:bg-gray-50 transition-colors">
            <Plus size={14} /> Add Platter Item
          </button>
          {cateringItems.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No platter items yet.</p>
          ) : (
            <div className="bg-gray-50 rounded-xl divide-y divide-gray-100 overflow-hidden">
              {cateringItems.map(ci => {
                const lineCount = cateringItemLines.filter(l => l.catering_item_id === ci.id).length;
                return (
                  <div key={ci.id} className="flex items-center gap-2 px-3 py-2.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: ci.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{ci.name}</p>
                      <p className="text-xs text-gray-400">{ci.pieces_per_unit} pcs / {ci.unit_label} · {lineCount} ingredient{lineCount === 1 ? '' : 's'}</p>
                    </div>
                    <button onClick={() => setEditing(ci)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                      <Edit2 size={13} />
                    </button>
                    <button onClick={() => handleDelete(ci)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

// ── Mini month calendar ──────────────────────────────────────────────────────

function MiniCalendar({ year, month, onMonthChange, selectedDate, onSelectDate, jobCountByDate }) {
  const days = useMemo(() => getMonthGrid(year, month), [year, month]);
  const todayKey = todayStr();

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-3">
      <div className="flex items-center justify-between mb-2 px-1">
        <button onClick={() => onMonthChange(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-semibold text-gray-900">{monthLabel(year, month)}</span>
        <button onClick={() => onMonthChange(1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <div key={i} className="text-center text-[10px] font-medium text-gray-400 py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((d, i) => {
          const key = fmtISO(d);
          const inMonth = d.getMonth() === month;
          const isToday = key === todayKey;
          const isSelected = key === selectedDate;
          const count = jobCountByDate.get(key) || 0;
          return (
            <button
              key={i}
              onClick={() => onSelectDate(key)}
              className="relative aspect-square flex flex-col items-center justify-center rounded-lg text-xs transition-colors"
              style={{
                color: !inMonth ? '#D1D5DB' : isSelected ? 'white' : isToday ? 'var(--primary-dk)' : '#374151',
                background: isSelected ? 'var(--primary)' : isToday ? 'color-mix(in srgb, var(--primary) 10%, white)' : 'transparent',
                fontWeight: isToday || isSelected ? 700 : 400,
              }}
            >
              {d.getDate()}
              {count > 0 && (
                <span
                  className="absolute bottom-1 w-1 h-1 rounded-full"
                  style={{ background: isSelected ? 'white' : 'var(--primary)' }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Dietary checkbox + inline quantity ───────────────────────────────────────

function DietaryToggle({ label, value, onChange }) {
  const checked = value !== '' && value !== null && value !== undefined;
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 ${checked ? 'border-gray-300 bg-gray-50' : 'border-gray-200'}`}>
      <label className="flex-1 flex items-center gap-1.5 text-sm text-gray-700 select-none cursor-pointer truncate">
        <input
          type="checkbox"
          checked={checked}
          onChange={e => onChange(e.target.checked ? '1' : '')}
          className="rounded shrink-0"
        />
        <span className="truncate">{label}</span>
      </label>
      {checked && (
        <input
          type="number"
          min="0"
          autoFocus
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={e => e.target.select()}
          className="w-12 shrink-0 border border-gray-200 rounded-md px-1 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-gray-200"
        />
      )}
    </div>
  );
}

// ── Menu item breakdown editor ───────────────────────────────────────────────

function emptyMenuItem() {
  return { catering_item_id: null, name: '', pieces: '', packaging: 'none', unit_qty: '' };
}

// A row's unit conversion comes from its linked library item's own
// pieces-per-unit ratio (e.g. 3 for a wrap, 16 for a whole focaccia) when
// picked from the catering library, or the generic packaging bucket for a
// freeform/custom item that isn't in the library.
function unitQtyForRow(pieces, row, cateringItemsById) {
  if (row.catering_item_id) return computeUnitQtyForItem(pieces, cateringItemsById.get(row.catering_item_id));
  return computeUnitQty(pieces, row.packaging);
}

function MenuItemsEditor({ items, totalPieces, onChange, cateringItems }) {
  const cateringItemsById = useMemo(() => new Map(cateringItems.map(ci => [ci.id, ci])), [cateringItems]);

  // Redistributes totalPieces evenly across every row, keeping each row's
  // own unit conversion in sync -- used on add/remove and via the explicit
  // "Split Evenly" button. Rows stay freely editable afterwards.
  function splitEvenly(list) {
    if (!totalPieces || list.length === 0) return list;
    const shares = distributeEvenly(totalPieces, list.length);
    return list.map((it, i) => ({ ...it, pieces: shares[i], unit_qty: unitQtyForRow(shares[i], it, cateringItemsById) }));
  }

  function updateRow(idx, patch) {
    onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }
  function handlePiecesChange(idx, value) {
    updateRow(idx, { pieces: value, unit_qty: unitQtyForRow(value, items[idx], cateringItemsById) });
  }
  function handlePackagingChange(idx, value) {
    updateRow(idx, { packaging: value, unit_qty: computeUnitQty(items[idx].pieces, value) });
  }
  // Switching the picker between a library item and "Custom item…" (value
  // '') re-derives the unit conversion from whichever ratio now applies.
  function handleCateringItemChange(idx, cateringItemId) {
    const row = items[idx];
    if (!cateringItemId) {
      updateRow(idx, { catering_item_id: null, unit_qty: computeUnitQty(row.pieces, row.packaging || 'none') });
      return;
    }
    const ci = cateringItemsById.get(cateringItemId);
    updateRow(idx, { catering_item_id: cateringItemId, name: ci?.name || row.name, unit_qty: computeUnitQtyForItem(row.pieces, ci) });
  }
  function addRow() {
    onChange(splitEvenly([...items, emptyMenuItem()]));
  }
  function removeRow(idx) {
    onChange(splitEvenly(items.filter((_, i) => i !== idx)));
  }

  const pieceTotal = items.reduce((s, it) => s + (Number(it.pieces) || 0), 0);
  const target = totalPieces != null ? Math.round(totalPieces) : null;
  const mismatch = target != null && items.length > 0 && pieceTotal !== target;

  return (
    <div className="space-y-2">
      {items.length === 0 && (
        <p className="text-xs text-gray-400 py-1">No menu items added yet.</p>
      )}
      {items.map((it, idx) => {
        const linked = cateringItemsById.get(it.catering_item_id);
        return (
          <div key={idx} className="border border-gray-200 rounded-lg p-2 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <select
                value={it.catering_item_id || ''}
                onChange={e => handleCateringItemChange(idx, e.target.value)}
                className="flex-1 min-w-0 border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-200"
              >
                <option value="">Custom item…</option>
                {cateringItems.map(ci => <option key={ci.id} value={ci.id}>{ci.name}</option>)}
              </select>
              <button onClick={() => removeRow(idx)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0">
                <Trash2 size={14} />
              </button>
            </div>
            {!it.catering_item_id && (
              <input
                list="menu-item-suggestions"
                value={it.name}
                onChange={e => updateRow(idx, { name: e.target.value })}
                placeholder="Item name, e.g. Chicken Avo Wrap"
                className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
              />
            )}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide shrink-0">Pieces</span>
              <input
                type="number"
                min="0"
                value={it.pieces}
                onChange={e => handlePiecesChange(idx, e.target.value)}
                className="w-16 shrink-0 border border-gray-200 rounded-lg px-1.5 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-gray-200"
              />
              {it.catering_item_id ? (
                <span className="ml-auto text-xs text-gray-500">
                  <span className="font-semibold text-gray-700">{it.unit_qty || 0}</span> {linked?.unit_label || 'unit'}{Number(it.unit_qty) === 1 ? '' : 's'}
                </span>
              ) : (
                <>
                  <select
                    value={it.packaging || 'none'}
                    onChange={e => handlePackagingChange(idx, e.target.value)}
                    className="w-20 shrink-0 border border-gray-200 rounded-lg px-1 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-gray-200"
                  >
                    {PACKAGING_TYPES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                  </select>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={it.unit_qty}
                    onChange={e => updateRow(idx, { unit_qty: e.target.value })}
                    title="Calculated from pieces -- edit to override"
                    className="w-14 shrink-0 border border-gray-200 rounded-lg px-1.5 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-gray-200"
                  />
                </>
              )}
            </div>
          </div>
        );
      })}
      <datalist id="menu-item-suggestions">
        {COMMON_MENU_ITEMS.map(n => <option key={n} value={n} />)}
      </datalist>
      <div className="flex items-center justify-between pt-0.5 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button onClick={addRow} className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            <Plus size={13} /> Add menu item
          </button>
          <button
            onClick={() => onChange(splitEvenly(items))}
            disabled={!totalPieces || items.length === 0}
            title={totalPieces ? 'Redistribute total pieces evenly across every item' : 'Set Platter Size and Pieces / Person first'}
            className="text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
          >
            Split Evenly
          </button>
        </div>
        {items.length > 0 && (
          <span className={`text-xs pr-1 ${mismatch ? 'text-amber-600' : 'text-gray-400'}`}>
            Breakdown total: <span className="font-semibold">{pieceTotal}</span>{target != null && ` / ${target}`}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Add / Edit Catering Job form ─────────────────────────────────────────────

function emptyJob(date) {
  return {
    job_date: date, company: '', contact: '', job_type: 'Lunch', address: '', ready_by: '', deliver_by: '',
    delivery_method: '', platter_size: '', pieces_per_person: DEFAULT_PIECES_PER_PERSON, salads: '',
    breakfast_ppl: '', coffee_ppl: '', gf_ppl: '', vego_ppl: '', pb_ppl: '', dairy_free_ppl: '', halal_ppl: '',
    confirmed: false, invoiced: false, bread_ordered: false, delivery_booked: false,
    gross_rev: '', notes: '', items: [],
  };
}

function toNumOrNull(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}
// Saved jobs can carry `null` for any optional text field -- trim() would
// throw directly on that, so route every text field through this first.
function trimOrEmpty(v) {
  return (v ?? '').toString().trim();
}

function JobFormModal({ orgId, userId, date, job, cateringItems, onClose, onSaved }) {
  const [draft, setDraft] = useState(() => job ? {
    ...emptyJob(date),
    ...job,
    company: job.company ?? '', contact: job.contact ?? '', job_type: job.job_type ?? 'Lunch',
    address: job.address ?? '', ready_by: job.ready_by ?? '', deliver_by: job.deliver_by ?? '', delivery_method: job.delivery_method ?? '',
    salads: job.salads ?? '', notes: job.notes ?? '',
    platter_size: job.platter_size ?? '', pieces_per_person: job.pieces_per_person ?? DEFAULT_PIECES_PER_PERSON,
    breakfast_ppl: job.breakfast_ppl ?? '', coffee_ppl: job.coffee_ppl ?? '',
    gf_ppl: job.gf_ppl ?? '', vego_ppl: job.vego_ppl ?? '', pb_ppl: job.pb_ppl ?? '',
    dairy_free_ppl: job.dairy_free_ppl ?? '', halal_ppl: job.halal_ppl ?? '',
    gross_rev: job.gross_rev ?? '',
    items: (job.items || []).map(it => ({
      catering_item_id: it.catering_item_id || null,
      name: it.name ?? '',
      pieces: it.pieces ?? it.qty ?? '',
      packaging: it.packaging || 'none',
      unit_qty: it.unit_qty ?? '',
    })),
  } : emptyJob(date));
  const [saving, setSaving] = useState(false);

  function set(field, value) {
    setDraft(prev => ({ ...prev, [field]: value }));
  }

  const totalPieces = computeTotalPieces(draft.platter_size, draft.pieces_per_person);

  // If Platter Size / Pieces-per-Person changes (or is set) after menu items
  // were already added with no pieces filled in yet, split the new total
  // across them automatically -- covers building the item list first and
  // setting the platter size after, same as the more common other way round.
  useEffect(() => {
    if (!totalPieces) return;
    setDraft(prev => {
      if (!prev.items || prev.items.length === 0) return prev;
      const allEmpty = prev.items.every(it => it.pieces === '' || it.pieces == null || Number(it.pieces) === 0);
      if (!allEmpty) return prev;
      const shares = distributeEvenly(totalPieces, prev.items.length);
      return { ...prev, items: prev.items.map((it, i) => ({ ...it, pieces: shares[i], unit_qty: computeUnitQty(shares[i], it.packaging) })) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPieces]);

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        job_date: draft.job_date,
        company: trimOrEmpty(draft.company) || null,
        contact: trimOrEmpty(draft.contact) || null,
        job_type: draft.job_type || null,
        address: trimOrEmpty(draft.address) || null,
        ready_by: trimOrEmpty(draft.ready_by) || null,
        deliver_by: trimOrEmpty(draft.deliver_by) || null,
        delivery_method: trimOrEmpty(draft.delivery_method) || null,
        platter_size: toNumOrNull(draft.platter_size),
        pieces_per_person: toNumOrNull(draft.pieces_per_person),
        salads: trimOrEmpty(draft.salads) || null,
        breakfast_ppl: toNumOrNull(draft.breakfast_ppl),
        coffee_ppl: toNumOrNull(draft.coffee_ppl),
        gf_ppl: toNumOrNull(draft.gf_ppl),
        vego_ppl: toNumOrNull(draft.vego_ppl),
        pb_ppl: toNumOrNull(draft.pb_ppl),
        dairy_free_ppl: toNumOrNull(draft.dairy_free_ppl),
        halal_ppl: toNumOrNull(draft.halal_ppl),
        confirmed: !!draft.confirmed,
        invoiced: !!draft.invoiced,
        bread_ordered: !!draft.bread_ordered,
        delivery_booked: !!draft.delivery_booked,
        gross_rev: toNumOrNull(draft.gross_rev),
        notes: trimOrEmpty(draft.notes) || null,
        items: (draft.items || [])
          .filter(it => trimOrEmpty(it.name))
          .map(it => ({
            catering_item_id: it.catering_item_id || null,
            name: trimOrEmpty(it.name),
            pieces: toNumOrNull(it.pieces) ?? 0,
            packaging: it.packaging || 'none',
            unit_qty: toNumOrNull(it.unit_qty),
          })),
      };
      if (job?.id) {
        await db.updateCateringJob(job.id, userId, payload);
        toast.success('Catering job updated');
      } else {
        await db.createCateringJob(orgId, userId, payload);
        toast.success('Catering job added');
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error('Failed to save job: ' + (err.message || 'unknown error'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={job ? 'Edit Catering Job' : 'Add Catering Job'} onClose={onClose} maxWidth="max-w-2xl">
      <div className="space-y-6">
        {/* Basics */}
        <div>
          <SectionLabel>Job Details</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <input type="date" value={draft.job_date} onChange={e => set('job_date', e.target.value)} className={inputCls} />
            </Field>
            <Field label="Type">
              <select value={draft.job_type} onChange={e => set('job_type', e.target.value)} className={inputCls + ' bg-white'}>
                {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Company">
              <input value={draft.company} onChange={e => set('company', e.target.value)} placeholder="e.g. Betashares" className={inputCls} />
            </Field>
            <Field label="Contact">
              <input value={draft.contact} onChange={e => set('contact', e.target.value)} placeholder="e.g. Karyne" className={inputCls} />
            </Field>
            <Field label="Address / Location">
              <input value={draft.address} onChange={e => set('address', e.target.value)} placeholder="Delivery address or Pick-up" className={inputCls} />
            </Field>
            <Field label="Pick-Up Time">
              <input value={draft.ready_by} onChange={e => set('ready_by', e.target.value)} placeholder="e.g. 11:30 or 11:30-12:00" className={inputCls} />
            </Field>
            <Field label="Deliver By">
              <input value={draft.deliver_by} onChange={e => set('deliver_by', e.target.value)} placeholder="Time requested by the customer" className={inputCls} />
            </Field>
            <Field label="Delivery Method">
              <input value={draft.delivery_method} onChange={e => set('delivery_method', e.target.value)} placeholder="Pick-up / Courier / CW" className={inputCls} />
            </Field>
            <Field label="Gross Revenue $">
              <input type="number" min="0" step="0.01" value={draft.gross_rev} onChange={e => set('gross_rev', e.target.value)} placeholder="0.00" className={inputCls} />
            </Field>
          </div>
        </div>

        {/* Platter */}
        <div>
          <SectionLabel>Sandwich Platter</SectionLabel>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Platter Size (ppl)">
              <input type="number" min="0" value={draft.platter_size} onChange={e => set('platter_size', e.target.value)} className={inputCls} />
            </Field>
            <Field label="Pieces / Person">
              <input type="number" min="0" step="0.5" value={draft.pieces_per_person} onChange={e => set('pieces_per_person', e.target.value)} className={inputCls} />
            </Field>
            <Field label="Total Pieces">
              <div className="w-full rounded-lg px-3 py-2 text-sm font-bold tabular-nums text-center" style={{ background: 'color-mix(in srgb, var(--primary) 8%, white)', color: 'var(--primary-dk)' }}>
                {totalPieces ?? '—'}
              </div>
            </Field>
          </div>
        </div>

        {/* Other quantities */}
        <div>
          <SectionLabel>Other Quantities</SectionLabel>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Salads">
              <input value={draft.salads} onChange={e => set('salads', e.target.value)} placeholder="e.g. 2 x Large" className={inputCls} />
            </Field>
            <Field label="Breakfast (ppl)">
              <input type="number" min="0" value={draft.breakfast_ppl} onChange={e => set('breakfast_ppl', e.target.value)} className={inputCls} />
            </Field>
            <Field label="Coffee (ppl)">
              <input type="number" min="0" value={draft.coffee_ppl} onChange={e => set('coffee_ppl', e.target.value)} className={inputCls} />
            </Field>
          </div>
        </div>

        {/* Dietaries */}
        <div>
          <SectionLabel>Dietaries</SectionLabel>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {DIETARY_FIELDS.map(f => (
              <DietaryToggle key={f.key} label={f.label} value={draft[f.key]} onChange={v => set(f.key, v)} />
            ))}
          </div>
        </div>

        {/* Menu item breakdown */}
        <div>
          <SectionLabel>Menu Item Breakdown</SectionLabel>
          <MenuItemsEditor items={draft.items} totalPieces={totalPieces} onChange={v => set('items', v)} cateringItems={cateringItems} />
        </div>

        {/* Notes */}
        <Field label="Notes">
          <textarea
            value={draft.notes}
            onChange={e => set('notes', e.target.value)}
            rows={3}
            placeholder="Dietary nuances, special requests, anything the kitchen needs to know…"
            className={inputCls}
          />
        </Field>

        {/* Admin checkboxes */}
        <div>
          <SectionLabel>Status</SectionLabel>
          <div className="flex flex-wrap gap-4">
            {CHECKBOX_FIELDS.map(f => (
              <label key={f.key} className="flex items-center gap-1.5 text-sm text-gray-700 select-none cursor-pointer">
                <input type="checkbox" checked={!!draft[f.key]} onChange={e => set(f.key, e.target.checked)} className="rounded" />
                {f.label}
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2 text-sm font-medium hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} className="flex-1 text-white rounded-xl py-2 text-sm font-semibold disabled:opacity-50" style={{ background: 'var(--primary)' }}>
            {saving ? 'Saving…' : job ? 'Save Changes' : 'Add Job'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Job card (day list) ──────────────────────────────────────────────────────

function StatTile({ label, value, highlight }) {
  return (
    <div
      className={`rounded-lg px-3 py-2 text-center ${highlight ? '' : 'border border-gray-100'}`}
      style={highlight ? { background: 'color-mix(in srgb, var(--primary) 8%, white)' } : {}}
    >
      <div className="text-[10px] font-medium uppercase tracking-wide text-gray-400 mb-0.5">{label}</div>
      <div className="text-base font-bold tabular-nums" style={{ color: highlight ? 'var(--primary-dk)' : '#111827' }}>{value}</div>
    </div>
  );
}

function Tag({ children }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md bg-gray-100 text-gray-600 whitespace-nowrap">
      {children}
    </span>
  );
}

function summarizeQty(job, totalPieces) {
  const parts = [];
  if (job.platter_size) parts.push(`${job.platter_size} ppl${totalPieces ? ` · ${totalPieces} pcs` : ''}`);
  if (job.breakfast_ppl) parts.push(`${job.breakfast_ppl} ppl breakfast`);
  if (job.coffee_ppl) parts.push(`${job.coffee_ppl} coffees`);
  if (job.salads) parts.push(job.salads);
  return parts.join(' · ');
}

// The exact ingredient/component volumes needed to make this job -- rolled
// up from every linked menu item's own catering recipe, scaled by how many
// whole units of it the job needs. Split into "Prep" (sub-recipes/batch
// mixes to make ahead) and a shopping list grouped by stock category, the
// same PTN/PHF/etc. split R-Recipe's own stock catalog already uses.
function IngredientsRequiredPanel({ rollup }) {
  const hasAny = rollup.prep.length > 0 || rollup.shoppingByCategory.length > 0;
  if (!hasAny) {
    return rollup.hasUnlinkedItems ? (
      <p className="text-xs text-gray-400 italic px-1">
        No ingredient volumes to show — link this job's menu items to the Platter Items library to calculate them.
      </p>
    ) : null;
  }
  return (
    <div className="rounded-lg border border-gray-100 divide-y divide-gray-100 overflow-hidden">
      <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 bg-gray-50 flex items-center justify-between">
        <span>Ingredients Required</span>
        {rollup.hasUnlinkedItems && <span className="text-amber-500 normal-case font-medium">excludes custom items</span>}
      </div>
      {rollup.prep.length > 0 && (
        <div className="divide-y divide-gray-50">
          <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-400 bg-gray-50/60">Prep</div>
          {rollup.prep.map(row => (
            <div key={row.id} className="flex items-center justify-between px-3 py-1.5 text-sm">
              <span className="text-gray-700">{row.name}</span>
              <span className="font-semibold tabular-nums text-gray-900">{fmtQty(row.qty)} {row.uom}</span>
            </div>
          ))}
        </div>
      )}
      {rollup.shoppingByCategory.map(([cat, rows]) => (
        <div key={cat} className="divide-y divide-gray-50">
          <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-400 bg-gray-50/60">{cat}</div>
          {rows.map(row => (
            <div key={row.id} className="flex items-center justify-between px-3 py-1.5 text-sm">
              <span className="text-gray-700">{row.name}</span>
              <span className="font-semibold tabular-nums text-gray-900">{fmtQty(row.qty)} {row.uom}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function JobCard({ job, expanded, onToggle, onEdit, onDelete, onToggleFlag, cateringItemLines, stockItemsById, componentsById }) {
  const dotColor = TYPE_DOT[job.job_type] || TYPE_DOT.Other;
  const totalPieces = computeTotalPieces(job.platter_size, job.pieces_per_person);
  const dietaryTags = DIETARY_FIELDS.filter(f => job[f.key] > 0);
  const itemsTotal = (job.items || []).reduce((s, it) => s + (Number(it.pieces ?? it.qty) || 0), 0);
  const summary = summarizeQty(job, totalPieces);
  const rollup = useMemo(
    () => computeIngredientRollup(job.items, cateringItemLines, stockItemsById, componentsById),
    [job.items, cateringItemLines, stockItemsById, componentsById]
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50/70 transition-colors">
        <div className="w-14 shrink-0 text-xs font-medium text-gray-500 tabular-nums">{job.ready_by || '—'}</div>
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dotColor }} title={job.job_type} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{job.company || 'Untitled job'}</p>
          <p className="text-xs text-gray-400 truncate">{[job.contact, job.job_type].filter(Boolean).join(' · ')}</p>
        </div>
        {summary && <div className="hidden sm:block text-xs text-gray-500 whitespace-nowrap">{summary}</div>}
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: job.confirmed ? '#16A34A' : '#D97706' }} title={job.confirmed ? 'Confirmed' : 'Pending'} />
        {expanded ? <ChevronUp size={16} className="text-gray-300 shrink-0" /> : <ChevronDown size={16} className="text-gray-300 shrink-0" />}
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-4 space-y-4">

          {job.platter_size ? (
            <div className="grid grid-cols-3 gap-2">
              <StatTile label="Platter Size" value={`${job.platter_size} ppl`} />
              <StatTile label="Pieces / Person" value={job.pieces_per_person ?? '—'} />
              <StatTile label="Total Pieces" value={totalPieces ?? '—'} highlight />
            </div>
          ) : null}

          {(job.breakfast_ppl || job.coffee_ppl || job.salads || dietaryTags.length > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {job.breakfast_ppl > 0 && <Tag>Breakfast: {job.breakfast_ppl} ppl</Tag>}
              {job.coffee_ppl > 0 && <Tag>Coffee: {job.coffee_ppl} ppl</Tag>}
              {job.salads && <Tag>Salads: {job.salads}</Tag>}
              {dietaryTags.map(f => (
                <Tag key={f.key}>{f.label}: <span className="font-bold text-gray-800">{job[f.key]}</span></Tag>
              ))}
            </div>
          )}

          {job.items && job.items.length > 0 && (
            <div className="rounded-lg border border-gray-100 divide-y divide-gray-50 overflow-hidden">
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 bg-gray-50">Menu Breakdown</div>
              {job.items.map((it, i) => {
                const pieces = it.pieces ?? it.qty ?? 0;
                const packagingLabel = PACKAGING_TYPES.find(p => p.key === it.packaging)?.label;
                const showUnits = it.packaging && it.packaging !== 'none' && it.unit_qty !== '' && it.unit_qty != null;
                return (
                  <div key={i} className="flex items-center justify-between px-3 py-1.5 text-sm">
                    <span className="text-gray-700">{it.name}</span>
                    <span className="flex items-baseline gap-2">
                      {showUnits && <span className="text-xs text-gray-400">{it.unit_qty} {packagingLabel.toLowerCase()}{it.unit_qty === 1 ? '' : 's'}</span>}
                      <span className="font-semibold tabular-nums text-gray-900">{pieces}</span>
                    </span>
                  </div>
                );
              })}
              <div className="flex items-center justify-between px-3 py-1.5 text-sm bg-gray-50">
                <span className="font-medium text-gray-500">Total pieces</span>
                <span className="font-bold tabular-nums text-gray-900">{itemsTotal}</span>
              </div>
            </div>
          )}

          {job.items && job.items.length > 0 && <IngredientsRequiredPanel rollup={rollup} />}

          <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-gray-500">
            {job.company && <div className="flex items-center gap-1.5"><Building2 size={12} className="text-gray-300 shrink-0" /> {job.company}</div>}
            {job.contact && <div className="flex items-center gap-1.5"><User size={12} className="text-gray-300 shrink-0" /> {job.contact}</div>}
            {job.address && <div className="flex items-center gap-1.5"><MapPin size={12} className="text-gray-300 shrink-0" /> {job.address}</div>}
            {job.delivery_method && <div className="flex items-center gap-1.5"><Truck size={12} className="text-gray-300 shrink-0" /> {job.delivery_method}</div>}
            {job.ready_by && <div className="flex items-center gap-1.5"><Clock size={12} className="text-gray-300 shrink-0" /> Pick-Up Time: {job.ready_by}</div>}
            {job.deliver_by && <div className="flex items-center gap-1.5"><Send size={12} className="text-gray-300 shrink-0" /> Deliver By: {job.deliver_by}</div>}
          </div>

          {job.notes && (
            <div className="flex items-start gap-1.5 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
              <StickyNote size={12} className="text-gray-400 shrink-0 mt-0.5" />
              <span className="whitespace-pre-wrap">{job.notes}</span>
            </div>
          )}

          {/* Admin */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100">
            <div className="flex flex-wrap gap-3">
              {CHECKBOX_FIELDS.map(f => (
                <label key={f.key} className="flex items-center gap-1.5 text-xs text-gray-500 select-none cursor-pointer">
                  <input type="checkbox" checked={!!job[f.key]} onChange={e => onToggleFlag(f.key, e.target.checked)} className="rounded" />
                  {f.label}
                </label>
              ))}
            </div>
            <div className="flex items-center gap-1">
              {job.gross_rev != null && (
                <span className="flex items-center gap-0.5 text-xs font-semibold text-gray-500 mr-2">
                  <DollarSign size={12} /> {Number(job.gross_rev).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              )}
              <button onClick={onEdit} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors" title="Edit">
                <Edit2 size={13} />
              </button>
              <button onClick={onDelete} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main CateringApp ─────────────────────────────────────────────────────────

export default function CateringApp({ org, user }) {
  const orgId = org?.id;
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [showLibrary, setShowLibrary] = useState(false);

  // Catering item library + its recipe lines, plus the shared R-Recipe/
  // stock catalogs needed to resolve ingredient names/units and to seed a
  // new library item's recipe from its linked menu item. Loaded once per
  // org, independent of the visible month/date.
  const [cateringItems, setCateringItems] = useState([]);
  const [cateringItemLines, setCateringItemLines] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [recipeComponents, setRecipeComponents] = useState([]);
  const [recipeMenuItemLines, setRecipeMenuItemLines] = useState([]);
  const [productionItems, setProductionItems] = useState([]);

  const gridDays = useMemo(() => getMonthGrid(calYear, calMonth), [calYear, calMonth]);
  const rangeStart = fmtISO(gridDays[0]);
  const rangeEnd = fmtISO(gridDays[gridDays.length - 1]);

  const loadJobs = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const rows = await db.getCateringJobsRange(orgId, rangeStart, rangeEnd);
      setJobs(rows);
    } catch (err) {
      toast.error('Failed to load catering jobs: ' + (err.message || 'unknown error'));
    } finally {
      setLoading(false);
    }
  }, [orgId, rangeStart, rangeEnd]);

  const loadCatalog = useCallback(async () => {
    if (!orgId) return;
    try {
      const [items, lines, skus, components, menuItemLines, prodItems] = await Promise.all([
        db.getCateringItems(orgId),
        db.getCateringItemLines(orgId),
        db.getStockItems(orgId),
        db.getRecipeComponents(orgId),
        db.getRecipeMenuItemLines(orgId),
        db.getProductionItems(orgId),
      ]);
      setCateringItems(items);
      setCateringItemLines(lines);
      setStockItems(skus);
      setRecipeComponents(components);
      setRecipeMenuItemLines(menuItemLines);
      setProductionItems(prodItems.filter(i => i.active !== false));
    } catch (err) {
      toast.error('Failed to load platter items library: ' + (err.message || 'unknown error'));
    }
  }, [orgId]);

  useEffect(() => { loadJobs(); }, [loadJobs]);
  useEffect(() => { loadCatalog(); }, [loadCatalog]);

  const stockItemsById = useMemo(() => new Map(stockItems.map(s => [s.id, s])), [stockItems]);
  const componentsById = useMemo(() => new Map(recipeComponents.map(c => [c.id, c])), [recipeComponents]);

  function changeMonth(delta) {
    let m = calMonth + delta;
    let y = calYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setCalMonth(m);
    setCalYear(y);
  }

  function selectDate(dateStr) {
    setSelectedDate(dateStr);
    setExpandedId(null);
    const d = new Date(dateStr + 'T12:00:00');
    if (d.getFullYear() !== calYear || d.getMonth() !== calMonth) {
      setCalYear(d.getFullYear());
      setCalMonth(d.getMonth());
    }
  }

  function goToday() {
    selectDate(todayStr());
  }

  function stepDay(n) {
    selectDate(addDays(selectedDate, n));
  }

  const jobCountByDate = useMemo(() => {
    const m = new Map();
    jobs.forEach(j => m.set(j.job_date, (m.get(j.job_date) || 0) + 1));
    return m;
  }, [jobs]);

  const jobsForDay = useMemo(() => jobs.filter(j => j.job_date === selectedDate), [jobs, selectedDate]);

  async function handleDelete(job) {
    if (!window.confirm(`Delete the catering job for "${job.company || 'this job'}"?`)) return;
    try {
      await db.deleteCateringJob(job.id);
      toast.success('Job deleted');
      loadJobs();
    } catch (err) {
      toast.error('Failed to delete job: ' + (err.message || 'unknown error'));
    }
  }

  async function handleToggleFlag(job, key, value) {
    setJobs(prev => prev.map(j => j.id === job.id ? { ...j, [key]: value } : j));
    try {
      await db.updateCateringJob(job.id, user.id, { [key]: value });
    } catch (err) {
      toast.error('Failed to update: ' + (err.message || 'unknown error'));
      loadJobs();
    }
  }

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--app-bg)' }}>
      {/* Toolbar */}
      <div className="shrink-0 border-b px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2 bg-white flex-wrap" style={{ borderColor: 'var(--top-border)' }}>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => stepDay(-1)}
            className="p-2 rounded-lg transition-colors hover:bg-gray-100 text-gray-500"
          >
            <ChevronLeft size={18} strokeWidth={2.5} />
          </button>
          <div className="text-center min-w-[150px]">
            <div className="text-sm font-semibold text-gray-900 leading-tight tracking-tight">{dayLabel(selectedDate)}</div>
            <div className="text-xs text-gray-400">{fmtDateShort(selectedDate)}</div>
          </div>
          <button
            onClick={() => stepDay(1)}
            className="p-2 rounded-lg transition-colors hover:bg-gray-100 text-gray-500"
          >
            <ChevronRight size={18} strokeWidth={2.5} />
          </button>
          {selectedDate !== todayStr() && (
            <button onClick={goToday} className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors ml-1">
              Today
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLibrary(true)}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            title="Manage platter items & recipes"
          >
            <Settings size={18} />
          </button>
          <button
            onClick={() => { setEditingJob(null); setShowForm(true); }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold text-white transition-colors"
            style={{ background: 'var(--primary)' }}
          >
            <Plus size={15} /> Add Catering Job
          </button>
        </div>
      </div>

      {/* Body: calendar + day list */}
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
        <aside className="w-full md:w-72 shrink-0 border-b md:border-b-0 md:border-r p-3 overflow-y-auto" style={{ borderColor: 'var(--top-border)' }}>
          <MiniCalendar
            year={calYear}
            month={calMonth}
            onMonthChange={changeMonth}
            selectedDate={selectedDate}
            onSelectDate={selectDate}
            jobCountByDate={jobCountByDate}
          />
        </aside>

        <main className="flex-1 overflow-y-auto p-3 sm:p-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={20} className="animate-spin text-gray-400" />
            </div>
          ) : jobsForDay.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <UtensilsCrossed size={28} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm mb-3">No catering jobs on this day.</p>
              <button
                onClick={() => { setEditingJob(null); setShowForm(true); }}
                className="inline-flex items-center gap-1.5 text-sm font-semibold px-3.5 py-2 rounded-xl text-white"
                style={{ background: 'var(--primary)' }}
              >
                <Plus size={14} /> Add Catering Job
              </button>
            </div>
          ) : (
            <div className="space-y-2 max-w-3xl mx-auto">
              {jobsForDay.map(job => (
                <JobCard
                  key={job.id}
                  job={job}
                  expanded={expandedId === job.id}
                  onToggle={() => setExpandedId(prev => prev === job.id ? null : job.id)}
                  onEdit={() => { setEditingJob(job); setShowForm(true); }}
                  onDelete={() => handleDelete(job)}
                  onToggleFlag={(key, value) => handleToggleFlag(job, key, value)}
                  cateringItemLines={cateringItemLines}
                  stockItemsById={stockItemsById}
                  componentsById={componentsById}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {showForm && (
        <JobFormModal
          orgId={orgId}
          userId={user?.id}
          date={selectedDate}
          job={editingJob}
          cateringItems={cateringItems}
          onClose={() => { setShowForm(false); setEditingJob(null); }}
          onSaved={loadJobs}
        />
      )}

      {showLibrary && (
        <CateringItemsLibraryModal
          orgId={orgId}
          cateringItems={cateringItems}
          cateringItemLines={cateringItemLines}
          stockItems={stockItems}
          components={recipeComponents}
          productionItems={productionItems}
          recipeMenuItemLines={recipeMenuItemLines}
          onClose={() => setShowLibrary(false)}
          onRefresh={loadCatalog}
        />
      )}
    </div>
  );
}
