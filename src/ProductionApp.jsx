import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus, Trash2, Edit2, X, Settings, ChevronLeft, ChevronRight, Minus,
  ClipboardList, Loader2, ChevronUp, ChevronDown, ChefHat,
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

// ── Constants ────────────────────────────────────────────────────────────────

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
  } catch {
    toast.error('Failed to reorder');
  }
}

// ── Item row (per-channel edit mode, or read-only totals mode) ────────────────

function ItemRow({ item, qty, mode, breakdown, onChange }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(qty));

  useEffect(() => { if (!editing) setDraft(String(qty)); }, [qty, editing]);

  function commit() {
    const n = parseInt(draft, 10);
    onChange(isNaN(n) || n < 0 ? 0 : n);
    setEditing(false);
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: item.color }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
        {breakdown && breakdown.length > 0 && (
          <p className="text-xs text-gray-400 truncate">{breakdown.map(b => `${b.name} ${b.qty}`).join(' · ')}</p>
        )}
      </div>
      {mode === 'totals' ? (
        <span className={`text-lg font-bold tabular-nums shrink-0 ${qty > 0 ? 'text-gray-900' : 'text-gray-300'}`}>{qty}</span>
      ) : (
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => onChange(Math.max(0, qty - 1))}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 active:scale-90 transition-transform"
          >
            <Minus size={15} />
          </button>
          {editing ? (
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
              className="w-14 text-center text-base font-bold border border-blue-300 rounded-lg py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="w-14 text-center text-base font-bold tabular-nums text-gray-900 py-1.5 rounded-lg hover:bg-gray-50"
            >
              {qty}
            </button>
          )}
          <button
            onClick={() => onChange(qty + 1)}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 active:scale-90 transition-transform"
          >
            <Plus size={15} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Empty states ─────────────────────────────────────────────────────────────

function EmptySetup({ onOpenSettings }) {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--sb-active, #DCFCE7)' }}>
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
    } catch {
      toast.error('Failed to add site');
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
    } catch {
      toast.error('Failed to rename site');
    }
  }

  async function handleDelete(site) {
    if (!window.confirm(`Delete "${site.name}"? Its channels and any planned quantities will be removed too.`)) return;
    try {
      await db.deleteProductionSite(site.id);
      onRefresh();
      toast.success('Site deleted');
    } catch {
      toast.error('Failed to delete site');
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
    } catch {
      toast.error('Failed to add channel');
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
    } catch {
      toast.error('Failed to rename channel');
    }
  }

  async function handleDelete(ch) {
    if (!window.confirm(`Delete "${ch.name}"? Any planned quantities for it will be removed too.`)) return;
    try {
      await db.deleteProductionChannel(ch.id);
      onRefresh();
      toast.success('Channel deleted');
    } catch {
      toast.error('Failed to delete channel');
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
    } catch {
      toast.error('Failed to save item');
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
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Category (optional)</label>
          <input
            value={category}
            onChange={e => setCategory(e.target.value)}
            placeholder="e.g. Sandwiches"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
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
    } catch {
      toast.error('Failed to delete item');
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
                <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
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
  const [activeTab, setActiveTab] = useState('totals'); // channel id, or 'totals'
  const [hideZero, setHideZero] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

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
    } catch {
      toast.error('Failed to load production setup');
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
    } catch {
      toast.error('Failed to load this day\'s plan');
    } finally {
      setLoadingPlan(false);
    }
  }, [orgId, date]);

  useEffect(() => { loadCatalog(); }, [loadCatalog]);
  useEffect(() => { loadPlan(); }, [loadPlan]);

  const channelsForSite = useMemo(() => channels.filter(c => c.site_id === activeSiteId), [channels, activeSiteId]);

  // Keep the channel/totals tab valid whenever the active site or channel list changes.
  useEffect(() => {
    setActiveTab(prev => (prev === 'totals' || channelsForSite.some(c => c.id === prev)) ? prev : (channelsForSite[0]?.id ?? 'totals'));
  }, [channelsForSite]);

  const qtyMap = useMemo(() => {
    const m = new Map();
    entries.forEach(e => m.set(`${e.item_id}:${e.channel_id}`, Number(e.qty) || 0));
    return m;
  }, [entries]);

  const getQty = useCallback((itemId, channelId) => qtyMap.get(`${itemId}:${channelId}`) || 0, [qtyMap]);

  async function handleQtyChange(itemId, channelId, qty) {
    setEntries(prev => {
      const exists = prev.find(e => e.item_id === itemId && e.channel_id === channelId);
      if (exists) return prev.map(e => e === exists ? { ...e, qty } : e);
      return [...prev, { item_id: itemId, channel_id: channelId, qty, plan_date: date }];
    });
    try {
      await db.setProductionPlanQty(orgId, user.id, { itemId, channelId, date, qty });
    } catch {
      toast.error('Failed to save — reloading');
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

  const activeItems = useMemo(() => {
    let list = items.filter(i => i.active !== false);
    if (!hideZero) return list;
    if (activeTab === 'totals') return list.filter(i => (totalsByItemForSite.get(i.id) || 0) > 0);
    return list.filter(i => getQty(i.id, activeTab) > 0);
  }, [items, activeTab, hideZero, totalsByItemForSite, getQty]);

  const grouped = useMemo(() => {
    const groups = new Map();
    activeItems.forEach(it => {
      const cat = it.category || 'Other';
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat).push(it);
    });
    return [...groups.entries()];
  }, [activeItems]);

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
        <div className="flex items-center gap-1.5">
          <button onClick={() => setDate(d => addDays(d, -1))} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            <ChevronLeft size={18} />
          </button>
          <div className="text-center min-w-[130px]">
            <div className="text-sm font-bold text-gray-900 leading-tight tracking-tight">{dayLabel(date)}</div>
            <div className="text-xs text-gray-400">{fmtDateShort(date)}</div>
          </div>
          <button onClick={() => setDate(d => addDays(d, 1))} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            <ChevronRight size={18} />
          </button>
        </div>
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
          <button onClick={() => setShowSettings(true)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors" title="Manage sites, channels & items">
            <Settings size={18} />
          </button>
        </div>
      </div>

      {noSetup ? (
        <EmptySetup onOpenSettings={() => setShowSettings(true)} />
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
          ) : (
            <>
              {/* Channel + Totals tabs */}
              <div className="shrink-0 border-b bg-white overflow-x-auto" style={{ borderColor: 'var(--top-border)' }}>
                <div className="flex gap-1 px-2 sm:px-3 py-2 min-w-max">
                  {channelsForSite.map(ch => (
                    <button
                      key={ch.id}
                      onClick={() => setActiveTab(ch.id)}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap ${activeTab === ch.id ? 'text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                      style={activeTab === ch.id ? { background: 'var(--primary)' } : {}}
                    >
                      {ch.name}
                      <span className={`ml-1.5 text-xs ${activeTab === ch.id ? 'opacity-80' : 'text-gray-400'}`}>{totalForChannel(ch)}</span>
                    </button>
                  ))}
                  <button
                    onClick={() => setActiveTab('totals')}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap ${activeTab === 'totals' ? 'text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                    style={activeTab === 'totals' ? { background: 'var(--primary)' } : {}}
                  >
                    Totals
                    <span className={`ml-1.5 text-xs ${activeTab === 'totals' ? 'opacity-80' : 'text-gray-400'}`}>{siteTotal}</span>
                  </button>
                </div>
              </div>

              {/* Toolbar */}
              <div className="shrink-0 px-4 py-2 flex items-center justify-between">
                <p className="text-xs text-gray-400">{activeItems.length} item{activeItems.length !== 1 ? 's' : ''}</p>
                <label className="flex items-center gap-1.5 text-xs text-gray-500 select-none cursor-pointer">
                  <input type="checkbox" checked={hideZero} onChange={e => setHideZero(e.target.checked)} className="rounded" />
                  Hide zero
                </label>
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto px-3 pb-8">
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
                  <div className="space-y-5 max-w-2xl mx-auto">
                    {grouped.map(([cat, its]) => (
                      <div key={cat}>
                        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mb-1.5">{cat}</h3>
                        <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50 overflow-hidden">
                          {its.map(item => (
                            <ItemRow
                              key={item.id}
                              item={item}
                              mode={activeTab === 'totals' ? 'totals' : 'edit'}
                              qty={activeTab === 'totals' ? (totalsByItemForSite.get(item.id) || 0) : getQty(item.id, activeTab)}
                              breakdown={activeTab === 'totals' ? channelsForSite.map(ch => ({ name: ch.name, qty: getQty(item.id, ch.id) })).filter(b => b.qty > 0) : null}
                              onChange={activeTab === 'totals' ? null : (q => handleQtyChange(item.id, activeTab, q))}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
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
