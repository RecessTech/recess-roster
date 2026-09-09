import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus, X, ChevronLeft, ChevronRight, Trash2, Edit2, Loader2, ChevronDown, ChevronUp,
  MapPin, Truck, DollarSign, StickyNote, User, Building2, UtensilsCrossed,
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
  return { name: '', pieces: '', packaging: 'none', unit_qty: '' };
}

function MenuItemsEditor({ items, totalPieces, onChange }) {
  // Redistributes totalPieces evenly across every row, keeping each row's
  // own packaging conversion in sync -- used on add/remove and via the
  // explicit "Split Evenly" button. Rows stay freely editable afterwards.
  function splitEvenly(list) {
    if (!totalPieces || list.length === 0) return list;
    const shares = distributeEvenly(totalPieces, list.length);
    return list.map((it, i) => ({ ...it, pieces: shares[i], unit_qty: computeUnitQty(shares[i], it.packaging) }));
  }

  function updateRow(idx, patch) {
    onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }
  function handlePiecesChange(idx, value) {
    updateRow(idx, { pieces: value, unit_qty: computeUnitQty(value, items[idx].packaging) });
  }
  function handlePackagingChange(idx, value) {
    updateRow(idx, { packaging: value, unit_qty: computeUnitQty(items[idx].pieces, value) });
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
      <datalist id="menu-item-suggestions">
        {COMMON_MENU_ITEMS.map(n => <option key={n} value={n} />)}
      </datalist>

      {items.length > 0 && (
        <div className="flex items-center gap-1.5 text-[10px] font-medium text-gray-400 uppercase tracking-wide px-0.5">
          <span className="flex-1">Item</span>
          <span className="w-14 text-center">Pieces</span>
          <span className="w-20 text-center">Packaging</span>
          <span className="w-14 text-center">Units</span>
          <span className="w-6" />
        </div>
      )}
      {items.length === 0 && (
        <p className="text-xs text-gray-400 py-1">No menu items added yet.</p>
      )}
      {items.map((it, idx) => (
        <div key={idx} className="flex items-center gap-1.5">
          <input
            list="menu-item-suggestions"
            value={it.name}
            onChange={e => updateRow(idx, { name: e.target.value })}
            placeholder="e.g. Chicken Avo Wrap"
            className="flex-1 min-w-0 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
          />
          <input
            type="number"
            min="0"
            value={it.pieces}
            onChange={e => handlePiecesChange(idx, e.target.value)}
            className="w-14 shrink-0 border border-gray-200 rounded-lg px-1.5 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-gray-200"
          />
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
          <button onClick={() => removeRow(idx)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0">
            <Trash2 size={14} />
          </button>
        </div>
      ))}
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
    job_date: date, company: '', contact: '', job_type: 'Lunch', address: '', ready_by: '',
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

function JobFormModal({ orgId, userId, date, job, onClose, onSaved }) {
  const [draft, setDraft] = useState(() => job ? {
    ...emptyJob(date),
    ...job,
    company: job.company ?? '', contact: job.contact ?? '', job_type: job.job_type ?? 'Lunch',
    address: job.address ?? '', ready_by: job.ready_by ?? '', delivery_method: job.delivery_method ?? '',
    salads: job.salads ?? '', notes: job.notes ?? '',
    platter_size: job.platter_size ?? '', pieces_per_person: job.pieces_per_person ?? DEFAULT_PIECES_PER_PERSON,
    breakfast_ppl: job.breakfast_ppl ?? '', coffee_ppl: job.coffee_ppl ?? '',
    gf_ppl: job.gf_ppl ?? '', vego_ppl: job.vego_ppl ?? '', pb_ppl: job.pb_ppl ?? '',
    dairy_free_ppl: job.dairy_free_ppl ?? '', halal_ppl: job.halal_ppl ?? '',
    gross_rev: job.gross_rev ?? '',
    items: (job.items || []).map(it => ({
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
            <Field label="Ready By">
              <input value={draft.ready_by} onChange={e => set('ready_by', e.target.value)} placeholder="e.g. 11:30 or 11:30-12:00" className={inputCls} />
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
          <MenuItemsEditor items={draft.items} totalPieces={totalPieces} onChange={v => set('items', v)} />
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

function JobCard({ job, expanded, onToggle, onEdit, onDelete, onToggleFlag }) {
  const dotColor = TYPE_DOT[job.job_type] || TYPE_DOT.Other;
  const totalPieces = computeTotalPieces(job.platter_size, job.pieces_per_person);
  const dietaryTags = DIETARY_FIELDS.filter(f => job[f.key] > 0);
  const itemsTotal = (job.items || []).reduce((s, it) => s + (Number(it.pieces ?? it.qty) || 0), 0);
  const summary = summarizeQty(job, totalPieces);

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

          <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-gray-500">
            {job.company && <div className="flex items-center gap-1.5"><Building2 size={12} className="text-gray-300 shrink-0" /> {job.company}</div>}
            {job.contact && <div className="flex items-center gap-1.5"><User size={12} className="text-gray-300 shrink-0" /> {job.contact}</div>}
            {job.address && <div className="flex items-center gap-1.5"><MapPin size={12} className="text-gray-300 shrink-0" /> {job.address}</div>}
            {job.delivery_method && <div className="flex items-center gap-1.5"><Truck size={12} className="text-gray-300 shrink-0" /> {job.delivery_method}</div>}
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

  useEffect(() => { loadJobs(); }, [loadJobs]);

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
        <button
          onClick={() => { setEditingJob(null); setShowForm(true); }}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold text-white transition-colors"
          style={{ background: 'var(--primary)' }}
        >
          <Plus size={15} /> Add Catering Job
        </button>
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
          onClose={() => { setShowForm(false); setEditingJob(null); }}
          onSaved={loadJobs}
        />
      )}
    </div>
  );
}
