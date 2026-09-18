import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus, Trash2, Edit2, X, Settings, ChevronLeft, ChevronRight,
  ClipboardList, Loader2, ChevronUp, ChevronDown, ChefHat, CheckCircle, BarChart3, Wheat, Sparkles,
  Scissors,
} from 'lucide-react';
import { db } from './supabaseClient';
import toast from 'react-hot-toast';
import ProductionInsights from './ProductionInsights';
import { buildDowAverages, forecastItemsForDate } from './forecastEngine';

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

// ── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_OPTIONS = ['Sandwiches', 'Toasties', 'Salads', 'Breakfast', 'Snacks', 'Drinks', 'Coffee & Tea', 'Bakery', 'Soups'];

// A loaf is 12 slices, 2 slices per sandwich/toastie -- 6 per loaf.
const BREAD_CATEGORIES = ['Sandwiches', 'Toasties'];
const SANDWICHES_PER_LOAF = 6;

const COLOR_PALETTE = [
  { name: 'Amber',  hex: '#F59E0B' },
  { name: 'Green',  hex: '#22C55E' },
  { name: 'Red',    hex: '#EF4444' },
  { name: 'Blue',   hex: '#3B82F6' },
  { name: 'Purple', hex: '#A855F7' },
  { name: 'Pink',   hex: '#EC4899' },
  { name: 'Teal',   hex: '#14B8A6' },
  { name: 'Slate',  hex: '#64748B' },
];

// ── Shared bits ──────────────────────────────────────────────────────────────

function Modal({ title, onClose, children, maxWidth = 'max-w-md' }) {
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

// Reassigns sort_order = index for the whole (small) list after a swap, so
// ordering stays well-defined even if it was never explicitly set before.
async function reorder(list, idx, dir, updateFn, onDone) {
  const other = idx + dir;
  if (other < 0 || other >= list.length) return;
  const next = [...list];
  [next[idx], next[other]] = [next[other], next[idx]];
  try {
    await Promise.all(next.map((row, i) => updateFn(row.id, { sort_order: i })));
    onDone();
  } catch (err) {
    toast.error('Failed to reorder: ' + (err.message || 'unknown error'));
  }
}

// ── Editable quantity cell (tap to type; read-only pill when locked) ─────────

function EditableCell({ qty, onChange, locked }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(qty));

  useEffect(() => { if (!editing) setDraft(String(qty)); }, [qty, editing]);

  function commit() {
    const n = parseInt(draft, 10);
    onChange(isNaN(n) || n < 0 ? 0 : n);
    setEditing(false);
  }

  const hasQty = qty > 0;

  if (locked) {
    return hasQty ? (
      <span className="inline-flex items-center justify-center min-w-[1.75rem] px-1.5 py-0.5 rounded-full text-xs sm:text-sm sm:min-w-[2.25rem] sm:px-2 sm:py-1 font-extrabold tabular-nums" style={{ background: '#DCFCE7', color: 'var(--primary)' }}>
        {qty}
      </span>
    ) : (
      <span className="text-xs sm:text-sm font-semibold tabular-nums text-gray-300">0</span>
    );
  }

  return editing ? (
    <input
      autoFocus
      type="number"
      inputMode="numeric"
      min="0"
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onFocus={e => e.target.select()}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
      className="w-10 sm:w-14 text-center text-xs sm:text-sm font-bold border border-blue-300 rounded-lg py-1 sm:py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
    />
  ) : (
    <button
      onClick={() => setEditing(true)}
      className={`min-w-[1.75rem] px-1.5 py-1 text-center text-xs sm:text-sm sm:min-w-[2.5rem] sm:px-2 sm:py-1.5 font-extrabold tabular-nums rounded-full transition-colors ${hasQty ? '' : 'text-gray-300 hover:bg-gray-100'}`}
      style={hasQty ? { background: '#DCFCE7', color: 'var(--primary)' } : {}}
    >
      {qty}
    </button>
  );
}

// ── One item's row across every channel column, plus a Total column ─────────

function ItemTableRow({ item, channels, getQty, total, locked, onChange }) {
  const hasQty = total > 0;
  const rowBg = hasQty ? '#F0FDF4' : 'white';

  return (
    <tr>
      <td className="px-2 py-1.5 sm:px-3 sm:py-2 sticky left-0 border-b border-gray-50" style={{ background: rowBg }}>
        <div className="flex items-center gap-1.5 min-w-[80px] sm:min-w-[130px]">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: item.color }} />
          <span className={`text-xs sm:text-sm truncate ${hasQty ? 'font-semibold text-gray-900' : 'font-medium text-gray-500'}`}>{item.name}</span>
        </div>
      </td>
      {channels.map(ch => (
        <td key={ch.id} className="px-1 py-1.5 sm:px-2 sm:py-2 text-center whitespace-nowrap border-b border-gray-50" style={{ background: rowBg }}>
          <EditableCell qty={getQty(item.id, ch.id)} locked={locked} onChange={q => onChange(item.id, ch.id, q)} />
        </td>
      ))}
      <td className="px-2 py-1.5 sm:px-3 sm:py-2 text-center whitespace-nowrap border-b border-gray-50" style={{ background: rowBg }}>
        {hasQty ? (
          <span className="inline-flex items-center justify-center min-w-[1.75rem] px-1.5 py-0.5 rounded-full text-xs sm:text-base sm:min-w-[2.5rem] sm:px-2.5 sm:py-1 font-extrabold tabular-nums" style={{ background: '#DCFCE7', color: 'var(--primary)' }}>
            {total}
          </span>
        ) : (
          <span className="text-xs sm:text-sm font-semibold tabular-nums text-gray-300">0</span>
        )}
      </td>
    </tr>
  );
}

// ── Empty states ─────────────────────────────────────────────────────────────

function EmptySetup({ onOpenSettings }) {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ background: '#DCFCE7' }}>
          <ChefHat size={22} style={{ color: 'var(--primary)' }} />
        </div>
        <h3 className="text-base font-semibold text-gray-900 mb-1.5">Set up production planning</h3>
        <p className="text-sm text-gray-500 mb-5">Add your sites (e.g. Crown St, Bourke St), the channels each one produces for, and your menu items to start planning daily production.</p>
        <button onClick={onOpenSettings} className="text-white rounded-xl px-4 py-2.5 text-sm font-semibold" style={{ background: 'var(--primary)' }}>
          Open Setup
        </button>
      </div>
    </div>
  );
}

function NoChannelsForSite({ siteName, onOpenSettings }) {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <ClipboardList size={28} className="mx-auto mb-3 text-gray-300" />
        <p className="text-sm text-gray-500 mb-4">No channels set up for <span className="font-semibold text-gray-700">{siteName}</span> yet.</p>
        <button onClick={onOpenSettings} className="text-white rounded-xl px-4 py-2 text-sm font-semibold" style={{ background: 'var(--primary)' }}>
          Add a Channel
        </button>
      </div>
    </div>
  );
}

// ── Settings: Sites ──────────────────────────────────────────────────────────

function SitesSettings({ orgId, sites, onRefresh }) {
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await db.createProductionSite(orgId, name.trim());
      setName('');
      onRefresh();
      toast.success('Site added');
    } catch (err) {
      toast.error('Failed to add site: ' + (err.message || 'unknown error'));
    } finally {
      setSaving(false);
    }
  }

  async function handleRename(site) {
    if (!editDraft.trim()) { setEditingId(null); return; }
    try {
      await db.updateProductionSite(site.id, { name: editDraft.trim() });
      setEditingId(null);
      onRefresh();
    } catch (err) {
      toast.error('Failed to rename site: ' + (err.message || 'unknown error'));
    }
  }

  async function handleDelete(site) {
    if (!window.confirm(`Delete "${site.name}"? Its channels and any planned quantities will be removed too.`)) return;
    try {
      await db.deleteProductionSite(site.id);
      onRefresh();
      toast.success('Site deleted');
    } catch (err) {
      toast.error('Failed to delete site: ' + (err.message || 'unknown error'));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="e.g. Crown St"
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
        <button
          onClick={handleAdd}
          disabled={saving || !name.trim()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-40"
          style={{ background: 'var(--primary)' }}
        >
          <Plus size={14} /> Add
        </button>
      </div>

      {sites.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">No sites yet.</p>
      ) : (
        <div className="bg-gray-50 rounded-2xl border border-gray-100 divide-y divide-gray-100 overflow-hidden">
          {sites.map((site, idx) => (
            <div key={site.id} className="flex items-center gap-2 px-3 py-2.5">
              <div className="flex flex-col -my-1">
                <button disabled={idx === 0} onClick={() => reorder(sites, idx, -1, db.updateProductionSite, onRefresh)} className="text-gray-300 hover:text-gray-600 disabled:opacity-30">
                  <ChevronUp size={13} />
                </button>
                <button disabled={idx === sites.length - 1} onClick={() => reorder(sites, idx, 1, db.updateProductionSite, onRefresh)} className="text-gray-300 hover:text-gray-600 disabled:opacity-30">
                  <ChevronDown size={13} />
                </button>
              </div>
              {editingId === site.id ? (
                <input
                  autoFocus
                  value={editDraft}
                  onChange={e => setEditDraft(e.target.value)}
                  onBlur={() => handleRename(site)}
                  onKeyDown={e => { if (e.key === 'Enter') handleRename(site); if (e.key === 'Escape') setEditingId(null); }}
                  className="flex-1 border border-blue-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              ) : (
                <span className="flex-1 text-sm font-medium text-gray-900">{site.name}</span>
              )}
              <button onClick={() => { setEditingId(site.id); setEditDraft(site.name); }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                <Edit2 size={13} />
              </button>
              <button onClick={() => handleDelete(site)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Settings: Channels (nested under a site) ─────────────────────────────────

function ChannelsSettings({ orgId, sites, channels, onRefresh }) {
  const [filterSiteId, setFilterSiteId] = useState(sites[0]?.id ?? null);
  useEffect(() => {
    if (!sites.some(s => s.id === filterSiteId)) setFilterSiteId(sites[0]?.id ?? null);
  }, [sites, filterSiteId]);

  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState('');
  const [saving, setSaving] = useState(false);

  if (sites.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-6">Add a site first — channels belong to a site.</p>;
  }

  const list = channels.filter(c => c.site_id === filterSiteId);

  async function handleAdd() {
    if (!name.trim() || !filterSiteId) return;
    setSaving(true);
    try {
      await db.createProductionChannel(orgId, filterSiteId, name.trim());
      setName('');
      onRefresh();
      toast.success('Channel added');
    } catch (err) {
      toast.error('Failed to add channel: ' + (err.message || 'unknown error'));
    } finally {
      setSaving(false);
    }
  }

  async function handleRename(ch) {
    if (!editDraft.trim()) { setEditingId(null); return; }
    try {
      await db.updateProductionChannel(ch.id, { name: editDraft.trim() });
      setEditingId(null);
      onRefresh();
    } catch (err) {
      toast.error('Failed to rename channel: ' + (err.message || 'unknown error'));
    }
  }

  async function handleDelete(ch) {
    if (!window.confirm(`Delete "${ch.name}"? Any planned quantities for it will be removed too.`)) return;
    try {
      await db.deleteProductionChannel(ch.id);
      onRefresh();
      toast.success('Channel deleted');
    } catch (err) {
      toast.error('Failed to delete channel: ' + (err.message || 'unknown error'));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {sites.map(s => (
          <button
            key={s.id}
            onClick={() => setFilterSiteId(s.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filterSiteId === s.id ? 'text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
            style={filterSiteId === s.id ? { background: 'var(--primary)' } : {}}
          >
            {s.name}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="e.g. Transfer to Crown"
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
        <button
          onClick={handleAdd}
          disabled={saving || !name.trim()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-40"
          style={{ background: 'var(--primary)' }}
        >
          <Plus size={14} /> Add
        </button>
      </div>

      {list.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">No channels for this site yet.</p>
      ) : (
        <div className="bg-gray-50 rounded-2xl border border-gray-100 divide-y divide-gray-100 overflow-hidden">
          {list.map((ch, idx) => (
            <div key={ch.id} className="flex items-center gap-2 px-3 py-2.5">
              <div className="flex flex-col -my-1">
                <button disabled={idx === 0} onClick={() => reorder(list, idx, -1, db.updateProductionChannel, onRefresh)} className="text-gray-300 hover:text-gray-600 disabled:opacity-30">
                  <ChevronUp size={13} />
                </button>
                <button disabled={idx === list.length - 1} onClick={() => reorder(list, idx, 1, db.updateProductionChannel, onRefresh)} className="text-gray-300 hover:text-gray-600 disabled:opacity-30">
                  <ChevronDown size={13} />
                </button>
              </div>
              {editingId === ch.id ? (
                <input
                  autoFocus
                  value={editDraft}
                  onChange={e => setEditDraft(e.target.value)}
                  onBlur={() => handleRename(ch)}
                  onKeyDown={e => { if (e.key === 'Enter') handleRename(ch); if (e.key === 'Escape') setEditingId(null); }}
                  className="flex-1 border border-blue-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              ) : (
                <span className="flex-1 text-sm font-medium text-gray-900">{ch.name}</span>
              )}
              <button onClick={() => { setEditingId(ch.id); setEditDraft(ch.name); }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                <Edit2 size={13} />
              </button>
              <button onClick={() => handleDelete(ch)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Settings: Items ──────────────────────────────────────────────────────────

function ItemFormModal({ item, onClose, onSave, orgId }) {
  const [name, setName] = useState(item?.name ?? '');
  const [category, setCategory] = useState(item?.category ?? '');
  const [color, setColor] = useState(item?.color ?? COLOR_PALETTE[0].hex);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) { toast.error('Item name is required'); return; }
    setSaving(true);
    try {
      const payload = { name: name.trim(), category: category.trim() || null, color };
      if (item?.id) {
        await db.updateProductionItem(item.id, payload);
        toast.success('Item updated');
      } else {
        await db.createProductionItem(orgId, payload);
        toast.success('Item added');
      }
      onSave();
      onClose();
    } catch (err) {
      toast.error('Failed to save item: ' + (err.message || 'unknown error'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={item ? 'Edit Item' : 'Add Item'} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Item Name</label>
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Chicken Avo"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Category</label>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
          >
            <option value="">— Select —</option>
            {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Colour</label>
          <div className="flex flex-wrap gap-2">
            {COLOR_PALETTE.map(c => (
              <button
                key={c.hex}
                title={c.name}
                onClick={() => setColor(c.hex)}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-105"
                style={{ background: c.hex, boxShadow: color === c.hex ? `0 0 0 2px white, 0 0 0 4px ${c.hex}` : 'none' }}
              />
            ))}
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2 text-sm font-medium hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} className="flex-1 text-white rounded-xl py-2 text-sm font-semibold disabled:opacity-50" style={{ background: 'var(--primary)' }}>
            {saving ? 'Saving…' : item ? 'Save Changes' : 'Add Item'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ItemsSettings({ orgId, items, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  async function handleDelete(item) {
    if (!window.confirm(`Delete "${item.name}"? Any planned quantities for it will be removed too.`)) return;
    try {
      await db.deleteProductionItem(item.id);
      onRefresh();
      toast.success('Item deleted');
    } catch (err) {
      toast.error('Failed to delete item: ' + (err.message || 'unknown error'));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{items.length} item{items.length !== 1 ? 's' : ''}</p>
        <button
          onClick={() => { setEditingItem(null); setShowForm(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium text-white"
          style={{ background: 'var(--primary)' }}
        >
          <Plus size={14} /> Add Item
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">No menu items yet.</p>
      ) : (
        <div className="bg-gray-50 rounded-2xl border border-gray-100 divide-y divide-gray-100 overflow-hidden">
          {items.map((item, idx) => (
            <div key={item.id} className="flex items-center gap-2 px-3 py-2.5">
              <div className="flex flex-col -my-1">
                <button disabled={idx === 0} onClick={() => reorder(items, idx, -1, db.updateProductionItem, onRefresh)} className="text-gray-300 hover:text-gray-600 disabled:opacity-30">
                  <ChevronUp size={13} />
                </button>
                <button disabled={idx === items.length - 1} onClick={() => reorder(items, idx, 1, db.updateProductionItem, onRefresh)} className="text-gray-300 hover:text-gray-600 disabled:opacity-30">
                  <ChevronDown size={13} />
                </button>
              </div>
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: item.color }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                  {item.is_special && (
                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-amber-600 bg-amber-50 border border-amber-100 rounded-full px-1.5 py-0.5">Special</span>
                  )}
                </div>
                {item.category && <p className="text-xs text-gray-400 truncate">{item.category}</p>}
              </div>
              <button onClick={() => { setEditingItem(item); setShowForm(true); }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                <Edit2 size={13} />
              </button>
              <button onClick={() => handleDelete(item)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <ItemFormModal
          item={editingItem}
          orgId={orgId}
          onClose={() => { setShowForm(false); setEditingItem(null); }}
          onSave={onRefresh}
        />
      )}
    </div>
  );
}

function SettingsModal({ orgId, sites, channels, items, onClose, onRefresh }) {
  const [subTab, setSubTab] = useState('items');
  return (
    <Modal title="Production Setup" onClose={onClose} maxWidth="max-w-lg">
      <div className="space-y-4">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
          <button
            onClick={() => setSubTab('items')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${subTab === 'items' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Menu Items
          </button>
          <button
            onClick={() => setSubTab('sites')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${subTab === 'sites' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Sites
          </button>
          <button
            onClick={() => setSubTab('channels')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${subTab === 'channels' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Channels
          </button>
        </div>
        {subTab === 'items' ? (
          <ItemsSettings orgId={orgId} items={items} onRefresh={onRefresh} />
        ) : subTab === 'sites' ? (
          <SitesSettings orgId={orgId} sites={sites} onRefresh={onRefresh} />
        ) : (
          <ChannelsSettings orgId={orgId} sites={sites} channels={channels} onRefresh={onRefresh} />
        )}
      </div>
    </Modal>
  );
}

// ── Production Order (per site/date priority list) ───────────────────────────

// Tap-to-edit percentage box for a split row -- same commit-on-blur idiom
// as EditableCell/QtyInput, clamped to 1-100 rather than treated as a
// free-form quantity.
function ShareInput({ pct, onCommit, disabled }) {
  const [draft, setDraft] = useState(String(pct));
  useEffect(() => { setDraft(String(pct)); }, [pct]);

  function commit() {
    const n = parseInt(draft, 10);
    const clamped = isNaN(n) ? pct : Math.min(100, Math.max(1, n));
    setDraft(String(clamped));
    if (clamped !== pct) onCommit(clamped);
  }

  return (
    <input
      type="number"
      min="1"
      max="100"
      disabled={disabled}
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
      className="w-12 text-center text-xs font-bold border border-gray-200 rounded-md px-1 py-0.5 disabled:opacity-50 disabled:bg-gray-50"
    />
  );
}

// Opt-in priority order for one site/date: only items an admin has
// actively ranked show up here, in the order staff should make them.
// Everything else with a planned quantity today just hasn't been ranked
// yet, and stays in "Not yet ordered" below (grouped by category, same as
// the planner) rather than forcing the admin to rank the whole menu daily.
//
// A "50/50 split" is modelled as two rows for the same item, each with its
// own position and share_pct -- the displayed quantity for each row is
// computed against the item's live total for the day, so it stays correct
// if the planned quantity changes later rather than going stale like a
// fixed split amount would.
function ProductionOrderPanel({ orgId, userId, siteId, date, items, totalsByItemForSite, locked }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!orgId || !siteId) return;
    setLoading(true);
    try {
      const data = await db.getProductionPriority(orgId, siteId, date);
      setRows(data.map(r => ({ item_id: r.item_id, share_pct: r.share_pct })));
    } catch (err) {
      toast.error('Failed to load production order: ' + (err.message || 'unknown error'));
    } finally {
      setLoading(false);
    }
  }, [orgId, siteId, date]);

  useEffect(() => { load(); }, [load]);

  async function persist(next) {
    const prev = rows;
    setRows(next);
    try {
      await db.saveProductionPriority(orgId, userId, siteId, date, next.map(r => ({ itemId: r.item_id, sharePct: r.share_pct })));
    } catch (err) {
      toast.error('Failed to save order: ' + (err.message || 'unknown error'));
      setRows(prev);
    }
  }

  const itemById = useMemo(() => new Map(items.map(i => [i.id, i])), [items]);

  const eligible = useMemo(
    () => items.filter(i => (totalsByItemForSite.get(i.id) || 0) > 0),
    [items, totalsByItemForSite]
  );

  const rankedItemIds = useMemo(() => new Set(rows.map(r => r.item_id)), [rows]);

  const unranked = useMemo(() => {
    const groups = new Map();
    eligible.filter(i => !rankedItemIds.has(i.id)).forEach(i => {
      const cat = i.category || 'Other';
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat).push(i);
    });
    return [...groups.entries()];
  }, [eligible, rankedItemIds]);

  function addToOrder(itemId) {
    persist([...rows, { item_id: itemId, share_pct: 100 }]);
  }

  function removeRow(idx) {
    persist(rows.filter((_, i) => i !== idx));
  }

  function move(idx, dir) {
    const other = idx + dir;
    if (other < 0 || other >= rows.length) return;
    const next = [...rows];
    [next[idx], next[other]] = [next[other], next[idx]];
    persist(next);
  }

  // Splits one row into two: the first half keeps its current spot, the
  // second is appended near the end of the order -- so the second batch
  // gets made later in the run, not right after the first.
  function splitRow(idx) {
    const row = rows[idx];
    const firstShare = Math.ceil(row.share_pct / 2);
    const secondShare = row.share_pct - firstShare;
    const next = [...rows];
    next[idx] = { ...row, share_pct: firstShare };
    next.push({ item_id: row.item_id, share_pct: secondShare });
    persist(next);
  }

  // Collapses every row for this item back into a single 100%-share row,
  // at the position of its first occurrence.
  function mergeItem(itemId) {
    const firstIdx = rows.findIndex(r => r.item_id === itemId);
    const withoutItem = rows.filter(r => r.item_id !== itemId);
    const insertAt = Math.min(firstIdx, withoutItem.length);
    withoutItem.splice(insertAt, 0, { item_id: itemId, share_pct: 100 });
    persist(withoutItem);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={18} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto px-3 sm:px-4 py-3">
      <div className="max-w-xl mx-auto space-y-5">
        {locked && (
          <div className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg" style={{ background: '#DCFCE7', color: 'var(--primary)' }}>
            <CheckCircle size={13} /> Day finalized — order is locked too. Unlock on the Planner tab to make changes.
          </div>
        )}

        <div>
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Make in this order</h3>
          {rows.length === 0 ? (
            <p className="text-sm text-gray-400 italic py-4 text-center">Nothing ordered yet — add items below to set a priority.</p>
          ) : (
            <div className="space-y-1.5">
              {rows.map((row, idx) => {
                const item = itemById.get(row.item_id);
                if (!item) return null;
                const total = totalsByItemForSite.get(row.item_id) || 0;
                const qty = Math.round((row.share_pct / 100) * total);
                const splitCount = rows.filter(r => r.item_id === row.item_id).length;
                return (
                  <div key={idx} className="flex items-center gap-2 bg-white border border-gray-100 rounded-xl px-3 py-2 shadow-sm">
                    <span className="w-5 text-center text-xs font-extrabold text-gray-300">{idx + 1}</span>
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: item.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-800 truncate">{item.name}</div>
                      {splitCount > 1 && <div className="text-[10px] text-gray-400">{row.share_pct}% of {total}</div>}
                    </div>
                    <span className="text-sm font-extrabold tabular-nums" style={{ color: 'var(--primary)' }}>{qty}</span>
                    {splitCount > 1 && !locked && (
                      <ShareInput pct={row.share_pct} disabled={locked} onCommit={pct => {
                        const next = [...rows];
                        next[idx] = { ...row, share_pct: pct };
                        persist(next);
                      }} />
                    )}
                    {!locked && (
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <button onClick={() => move(idx, -1)} disabled={idx === 0} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20 transition-colors">
                          <ChevronUp size={14} />
                        </button>
                        <button onClick={() => move(idx, 1)} disabled={idx === rows.length - 1} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20 transition-colors">
                          <ChevronDown size={14} />
                        </button>
                        {splitCount > 1 ? (
                          <button onClick={() => mergeItem(row.item_id)} className="text-[10px] font-semibold text-gray-400 hover:text-amber-600 px-1 transition-colors">
                            Merge
                          </button>
                        ) : (
                          <button onClick={() => splitRow(idx)} title="Split into two batches" className="p-1 text-gray-400 hover:text-amber-600 transition-colors">
                            <Scissors size={14} />
                          </button>
                        )}
                        <button onClick={() => removeRow(idx)} title="Remove from order" className="p-1 text-gray-400 hover:text-red-500 transition-colors">
                          <X size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Not yet ordered</h3>
          {unranked.length === 0 ? (
            <p className="text-sm text-gray-400 italic py-2">Every item with a planned quantity today is in the order.</p>
          ) : (
            <div className="space-y-3">
              {unranked.map(([cat, its]) => (
                <div key={cat}>
                  <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{cat}</div>
                  <div className="space-y-1">
                    {its.map(item => (
                      <div key={item.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: item.color }} />
                        <span className="flex-1 text-sm text-gray-600 truncate">{item.name}</span>
                        <span className="text-xs text-gray-400 tabular-nums">{totalsByItemForSite.get(item.id) || 0}</span>
                        {!locked && (
                          <button onClick={() => addToOrder(item.id)} title="Add to order" className="p-1 rounded-md text-white transition-transform hover:scale-105 active:scale-95" style={{ background: 'var(--primary)' }}>
                            <Plus size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main ProductionApp ───────────────────────────────────────────────────────

export default function ProductionApp({ org, user }) {
  const orgId = org?.id;
  const [sites, setSites] = useState([]);
  const [channels, setChannels] = useState([]);
  const [items, setItems] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [date, setDate] = useState(todayStr());
  const [activeSiteId, setActiveSiteId] = useState(null);
  const [hideZero, setHideZero] = useState(false);
  const [viewMode, setViewMode] = useState('planner'); // 'planner' | 'order' | 'insights'
  const [showSettings, setShowSettings] = useState(false);
  const [dayLock, setDayLock] = useState(null);
  const [finalizing, setFinalizing] = useState(false);
  const [pullingForecast, setPullingForecast] = useState(false);

  const loadCatalog = useCallback(async () => {
    if (!orgId) return;
    try {
      const [sts, chs, its] = await Promise.all([
        db.getProductionSites(orgId),
        db.getProductionChannels(orgId),
        db.getProductionItems(orgId),
      ]);
      setSites(sts);
      setChannels(chs);
      setItems(its);
      setActiveSiteId(prev => (prev && sts.some(s => s.id === prev)) ? prev : (sts[0]?.id ?? null));
    } catch (err) {
      toast.error('Failed to load production setup: ' + (err.message || 'unknown error'));
    } finally {
      setLoadingCatalog(false);
    }
  }, [orgId]);

  const loadPlan = useCallback(async () => {
    if (!orgId) return;
    setLoadingPlan(true);
    try {
      const rows = await db.getProductionPlan(orgId, date);
      setEntries(rows);
    } catch (err) {
      toast.error('Failed to load this day\'s plan: ' + (err.message || 'unknown error'));
    } finally {
      setLoadingPlan(false);
    }
  }, [orgId, date]);

  const loadLock = useCallback(async () => {
    if (!orgId || !activeSiteId) { setDayLock(null); return; }
    try {
      const row = await db.getProductionDayLock(orgId, activeSiteId, date);
      setDayLock(row);
    } catch (err) {
      toast.error('Failed to check finalize status: ' + (err.message || 'unknown error'));
    }
  }, [orgId, activeSiteId, date]);

  useEffect(() => { loadCatalog(); }, [loadCatalog]);
  useEffect(() => { loadPlan(); }, [loadPlan]);
  useEffect(() => { loadLock(); }, [loadLock]);

  async function handleFinalize() {
    if (!activeSiteId) return;
    setFinalizing(true);
    try {
      const row = await db.setProductionDayLock(orgId, user.id, activeSiteId, date);
      setDayLock(row);
      toast.success('Day finalized');
    } catch (err) {
      toast.error('Failed to finalize: ' + (err.message || 'unknown error'));
    } finally {
      setFinalizing(false);
    }
  }

  async function handleUnlock() {
    if (!activeSiteId) return;
    if (!window.confirm('Unlock this day so quantities can be edited again?')) return;
    setFinalizing(true);
    try {
      await db.clearProductionDayLock(activeSiteId, date);
      setDayLock(null);
    } catch (err) {
      toast.error('Failed to unlock: ' + (err.message || 'unknown error'));
    } finally {
      setFinalizing(false);
    }
  }

  const channelsForSite = useMemo(() => channels.filter(c => c.site_id === activeSiteId), [channels, activeSiteId]);

  const qtyMap = useMemo(() => {
    const m = new Map();
    entries.forEach(e => m.set(`${e.item_id}:${e.channel_id}`, Number(e.qty) || 0));
    return m;
  }, [entries]);

  const getQty = useCallback((itemId, channelId) => qtyMap.get(`${itemId}:${channelId}`) || 0, [qtyMap]);

  async function handleQtyChange(itemId, channelId, qty) {
    if (dayLock) { toast.error('This day is finalized — unlock it first.'); return; }
    setEntries(prev => {
      const exists = prev.find(e => e.item_id === itemId && e.channel_id === channelId);
      if (exists) return prev.map(e => e === exists ? { ...e, qty } : e);
      return [...prev, { item_id: itemId, channel_id: channelId, qty, plan_date: date }];
    });
    try {
      await db.setProductionPlanQty(orgId, user.id, { itemId, channelId, date, qty });
    } catch (err) {
      toast.error('Failed to save — reloading: ' + (err.message || 'unknown error'));
      loadPlan();
    }
  }

  const totalForChannel = useCallback(ch => items.reduce((sum, it) => sum + getQty(it.id, ch.id), 0), [items, getQty]);
  const siteTotal = useMemo(() => channelsForSite.reduce((sum, ch) => sum + totalForChannel(ch), 0), [channelsForSite, totalForChannel]);

  const totalsByItemForSite = useMemo(() => {
    const m = new Map();
    items.forEach(it => m.set(it.id, 0));
    const siteChannelIds = new Set(channelsForSite.map(c => c.id));
    entries.forEach(e => {
      if (!siteChannelIds.has(e.channel_id)) return;
      m.set(e.item_id, (m.get(e.item_id) || 0) + (Number(e.qty) || 0));
    });
    return m;
  }, [items, entries, channelsForSite]);

  const breadCount = useMemo(() => {
    return items.reduce((sum, it) => {
      if (!BREAD_CATEGORIES.includes(it.category)) return sum;
      return sum + (totalsByItemForSite.get(it.id) || 0);
    }, 0);
  }, [items, totalsByItemForSite]);
  const totalLoaves = breadCount / SANDWICHES_PER_LOAF;
  const loavesToOrder = Math.ceil(totalLoaves);

  // Items flagged (in R-Recipe) as not needing R-Prod planning -- made to
  // order or shelf stock, e.g. coffee, drinks -- or as special/no-longer-
  // on-the-menu -- limited-time items like a past Birria Toastie -- are
  // excluded everywhere in R-Prod (planner and Insights alike).
  const planningItems = useMemo(() => {
    return items.filter(i => i.active !== false && i.needs_prod_planning !== false && i.is_special !== true);
  }, [items]);

  const activeItems = useMemo(() => {
    if (!hideZero) return planningItems;
    return planningItems.filter(i => (totalsByItemForSite.get(i.id) || 0) > 0);
  }, [planningItems, hideZero, totalsByItemForSite]);

  const grouped = useMemo(() => {
    const groups = new Map();
    activeItems.forEach(it => {
      const cat = it.category || 'Other';
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat).push(it);
    });
    return [...groups.entries()];
  }, [activeItems]);

  // Pulls this date's Crystal Ball forecast -- same model as the Forecast
  // tab's own "Load to R-Prod" button, via the shared forecastEngine -- for
  // whichever of this site's items have a forecast, straight into the
  // site's In-Store channel. Items assigned to other sites, or with no
  // forecast yet, are left untouched.
  async function pullFromCrystalBall() {
    if (!activeSiteId) return;
    const inStoreChannel = channelsForSite.find(c => c.name === 'In-Store');
    if (!inStoreChannel) {
      toast.error('This site has no "In-Store" channel to pull the forecast into.');
      return;
    }
    setPullingForecast(true);
    try {
      const [history, cbSettings] = await Promise.all([
        db.getSalesHistory(orgId),
        db.getCrystalBallSettings(orgId),
      ]);
      const halfLifeDays = (Number(cbSettings?.recency_halflife_weeks) || 0) * 7;
      const uplift = 1 + (Number(cbSettings?.channel_uplift_pct) || 0) / 100;
      const dowAverages = buildDowAverages(history, halfLifeDays);
      const siteItems = planningItems.filter(i => i.site_id === activeSiteId);
      const targets = forecastItemsForDate(siteItems, dowAverages, uplift, date, todayStr()).filter(f => f.forecast > 0);
      if (targets.length === 0) {
        toast.error("No Crystal Ball forecast yet for this site's items on this date.");
        return;
      }
      for (const f of targets) {
        await db.setProductionPlanQty(orgId, user.id, { itemId: f.item.id, channelId: inStoreChannel.id, date, qty: Math.round(f.forecast) });
      }
      await loadPlan();
      toast.success(`Pulled forecast for ${targets.length} item${targets.length === 1 ? '' : 's'} into In-Store.`);
    } catch (err) {
      toast.error('Failed to pull forecast: ' + (err.message || 'unknown error'));
    } finally {
      setPullingForecast(false);
    }
  }

  if (loadingCatalog) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={20} className="animate-spin text-gray-400" />
      </div>
    );
  }

  const noSetup = sites.length === 0 || items.length === 0;
  const activeSite = sites.find(s => s.id === activeSiteId);

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--app-bg)' }}>
      {/* Date bar */}
      <div className="shrink-0 border-b px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2 bg-white flex-wrap" style={{ borderColor: 'var(--top-border)' }}>
        {viewMode === 'insights' ? (
          <div className="flex items-center gap-1.5">
            <BarChart3 size={16} className="text-gray-400" />
            <span className="text-sm font-bold text-gray-900">Insights</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setDate(d => addDays(d, -1))}
              className="p-2.5 rounded-lg transition-colors hover:brightness-95 active:brightness-90"
              style={{ background: 'color-mix(in srgb, var(--primary) 12%, white)', color: 'var(--primary-dk)' }}
            >
              <ChevronLeft size={20} strokeWidth={2.5} />
            </button>
            <div className="text-center min-w-[130px]">
              <div className="text-sm font-bold text-gray-900 leading-tight tracking-tight">{dayLabel(date)}</div>
              <div className="text-xs text-gray-400">{fmtDateShort(date)}</div>
            </div>
            <button
              onClick={() => setDate(d => addDays(d, 1))}
              className="p-2.5 rounded-lg transition-colors hover:brightness-95 active:brightness-90"
              style={{ background: 'color-mix(in srgb, var(--primary) 12%, white)', color: 'var(--primary-dk)' }}
            >
              <ChevronRight size={20} strokeWidth={2.5} />
            </button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
            {[{ id: 'planner', label: 'Planner' }, { id: 'order', label: 'Order' }, { id: 'insights', label: 'Insights' }].map(t => (
              <button
                key={t.id}
                onClick={() => setViewMode(t.id)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${viewMode === t.id ? 'text-white' : 'text-gray-500 hover:text-gray-700'}`}
                style={viewMode === t.id ? { background: 'var(--primary)' } : {}}
              >
                {t.label}
              </button>
            ))}
          </div>
          {viewMode !== 'insights' && (
            <div className="flex items-center gap-1.5">
              {date !== todayStr() && (
                <button onClick={() => setDate(todayStr())} className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors">
                  Today
                </button>
              )}
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-500"
              />
            </div>
          )}
          <button onClick={() => setShowSettings(true)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors" title="Manage sites, channels & items">
            <Settings size={18} />
          </button>
        </div>
      </div>

      {noSetup ? (
        <EmptySetup onOpenSettings={() => setShowSettings(true)} />
      ) : viewMode === 'insights' ? (
        <ProductionInsights orgId={orgId} items={planningItems} />
      ) : (
        <>
          {/* Site tabs */}
          <div className="shrink-0 border-b bg-white overflow-x-auto" style={{ borderColor: 'var(--top-border)' }}>
            <div className="flex gap-1.5 px-2 sm:px-3 py-2 min-w-max">
              {sites.map(s => (
                <button
                  key={s.id}
                  onClick={() => setActiveSiteId(s.id)}
                  className={`px-4 py-1.5 rounded-full text-sm font-bold transition-colors whitespace-nowrap border ${activeSiteId === s.id ? 'text-white border-transparent' : 'text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                  style={activeSiteId === s.id ? { background: 'var(--primary)' } : {}}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>

          {channelsForSite.length === 0 ? (
            <NoChannelsForSite siteName={activeSite?.name ?? 'this site'} onOpenSettings={() => setShowSettings(true)} />
          ) : viewMode === 'order' ? (
            <ProductionOrderPanel
              orgId={orgId}
              userId={user.id}
              siteId={activeSiteId}
              date={date}
              items={planningItems}
              totalsByItemForSite={totalsByItemForSite}
              locked={!!dayLock}
            />
          ) : (
            <>
              {/* Toolbar */}
              <div className="shrink-0 px-4 py-2 flex items-center justify-between gap-3 flex-wrap border-b" style={{ borderColor: 'var(--top-border)' }}>
                <div className="flex items-center gap-3 flex-wrap">
                  <p className="text-xs text-gray-400">{activeItems.length} item{activeItems.length !== 1 ? 's' : ''}</p>
                  {breadCount > 0 && (
                    <span
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={{ background: 'color-mix(in srgb, var(--primary) 12%, white)', color: 'var(--primary-dk)' }}
                      title={`${breadCount} sandwiches/toasties ÷ ${SANDWICHES_PER_LOAF} per loaf = ${totalLoaves.toFixed(1)} loaves`}
                    >
                      <Wheat size={13} />
                      Total Loaves: {loavesToOrder}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {!dayLock && (
                    <button
                      onClick={pullFromCrystalBall}
                      disabled={pullingForecast}
                      title="Pull this date's Crystal Ball forecast for this site's items into In-Store"
                      aria-label="Pull from Crystal Ball"
                      className="flex items-center justify-center w-9 h-9 rounded-full text-white shadow-md transition-transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
                      style={{ background: 'var(--primary)' }}
                    >
                      {pullingForecast ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    </button>
                  )}
                  {dayLock ? (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: '#DCFCE7', color: 'var(--primary)' }}>
                        <CheckCircle size={13} /> Finalized
                      </span>
                      <button onClick={handleUnlock} disabled={finalizing} className="text-xs text-gray-400 hover:text-red-500 disabled:opacity-50 transition-colors">
                        {finalizing ? 'Unlocking…' : 'Unlock'}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleFinalize}
                      disabled={finalizing}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-50 transition-colors"
                      style={{ background: 'var(--primary)' }}
                    >
                      {finalizing ? 'Finalizing…' : 'Submit Final Numbers'}
                    </button>
                  )}
                  <label className="flex items-center gap-1.5 text-xs text-gray-500 select-none cursor-pointer">
                    <input type="checkbox" checked={hideZero} onChange={e => setHideZero(e.target.checked)} className="rounded" />
                    Hide zero
                  </label>
                </div>
              </div>

              {/* Table: rows = items, columns = every channel for this site + a Total column */}
              <div className="flex-1 overflow-auto px-2 sm:px-4 py-2">
                {loadingPlan ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 size={18} className="animate-spin text-gray-400" />
                  </div>
                ) : activeItems.length === 0 ? (
                  <div className="text-center py-16 text-gray-400">
                    <ClipboardList size={32} className="mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Nothing to show{hideZero ? ' — try turning off "Hide zero"' : ''}.</p>
                  </div>
                ) : (
                  <table className="mx-auto text-sm border-collapse">
                    <thead>
                      <tr>
                        <th className="sticky top-0 left-0 z-20 bg-gray-50 text-left px-2 py-1.5 sm:px-3 sm:py-2 text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">Item</th>
                        {channelsForSite.map(ch => (
                          <th key={ch.id} className="sticky top-0 z-10 bg-gray-50 text-center px-1.5 py-1.5 sm:px-2 sm:py-2 text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100 whitespace-nowrap">
                            {ch.name}
                          </th>
                        ))}
                        <th className="sticky top-0 z-10 text-center px-2 py-1.5 sm:px-3 sm:py-2 text-[10px] sm:text-xs font-bold uppercase tracking-wide border-b border-gray-100 whitespace-nowrap" style={{ background: '#F0FDF4', color: 'var(--primary)' }}>
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {grouped.map(([cat, its]) => (
                        <React.Fragment key={cat}>
                          <tr>
                            <td colSpan={channelsForSite.length + 2} className="px-2 pt-2 pb-1 sm:px-3 sm:pt-3 text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wide bg-white sticky left-0">
                              {cat}
                            </td>
                          </tr>
                          {its.map(item => (
                            <ItemTableRow
                              key={item.id}
                              item={item}
                              channels={channelsForSite}
                              getQty={getQty}
                              total={totalsByItemForSite.get(item.id) || 0}
                              locked={!!dayLock}
                              onChange={handleQtyChange}
                            />
                          ))}
                        </React.Fragment>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td className="sticky left-0 bg-white px-2 py-2 sm:px-3 sm:py-2.5 text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wide border-t-2 border-gray-100">Total</td>
                        {channelsForSite.map(ch => (
                          <td key={ch.id} className="bg-white text-center px-1.5 py-2 sm:px-2 sm:py-2.5 text-xs sm:text-sm font-extrabold tabular-nums text-gray-700 border-t-2 border-gray-100 whitespace-nowrap">
                            {totalForChannel(ch)}
                          </td>
                        ))}
                        <td className="text-center px-2 py-2 sm:px-3 sm:py-2.5 text-sm sm:text-base font-extrabold tabular-nums border-t-2 border-gray-100 whitespace-nowrap" style={{ background: '#F0FDF4', color: 'var(--primary)' }}>
                          {siteTotal}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            </>
          )}
        </>
      )}

      {showSettings && (
        <SettingsModal orgId={orgId} sites={sites} channels={channels} items={items} onClose={() => setShowSettings(false)} onRefresh={loadCatalog} />
      )}

    </div>
  );
}
