import React, { useState, useEffect, useMemo } from 'react';
import {
  Package, Plus, Trash2, Edit2, X, MapPin,
  ClipboardList, AlertTriangle,
} from 'lucide-react';
import { db } from './supabaseClient';
import toast from 'react-hot-toast';

// ── Constants ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  ok:       { bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-700',  label: 'OK'      },
  low:      { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  label: 'Low'     },
  out:      { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700',    label: 'Out'     },
  unknown:  { bg: 'bg-gray-50',   border: 'border-gray-200',   text: 'text-gray-400',   label: 'No count' },
};

function statusFor(countedQty, parLevel) {
  if (countedQty === null || countedQty === undefined) return 'unknown';
  if (countedQty <= 0) return 'out';
  if (parLevel > 0 && countedQty < parLevel) return 'low';
  return 'ok';
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + 'T12:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

// ── Modal ─────────────────────────────────────────────────────────────────────

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

// ── Stocktake Tab ─────────────────────────────────────────────────────────────

function StocktakeTab({ items, locations, latestByKey, parByKey, user, orgId, onCountSaved }) {
  const [editingKey, setEditingKey] = useState(null); // `${itemId}:${locationId}`
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const grouped = useMemo(() => {
    const groups = {};
    for (const item of items) {
      const cat = item.category || 'Uncategorised';
      (groups[cat] = groups[cat] || []).push(item);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [items]);

  if (locations.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400">
        <MapPin size={32} className="mx-auto mb-3 opacity-40" />
        <p className="text-sm mb-1">No locations set up yet.</p>
        <p className="text-xs">Add a site in the Locations tab before recording a stocktake.</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400">
        <Package size={32} className="mx-auto mb-3 opacity-40" />
        <p className="text-sm mb-1">No items yet.</p>
        <p className="text-xs">Add your first SKU in the Items tab.</p>
      </div>
    );
  }

  function startEdit(itemId, locationId) {
    const key = `${itemId}:${locationId}`;
    setEditingKey(key);
    setDraft(latestByKey[key]?.counted_qty ?? '');
  }

  async function commitEdit(itemId, locationId) {
    const key = `${itemId}:${locationId}`;
    setEditingKey(null);
    const parsed = parseFloat(draft);
    if (isNaN(parsed) || parsed < 0) return;
    if (latestByKey[key]?.counted_qty === parsed) return;

    setSaving(true);
    try {
      const row = await db.recordStockCount(orgId, {
        itemId, locationId, countedQty: parsed, countedBy: user.id,
      });
      onCountSaved(key, row);
    } catch (err) {
      toast.error('Failed to save count');
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {grouped.map(([category, catItems]) => (
        <div key={category}>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{category}</h3>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Item</th>
                  {locations.map(loc => (
                    <th key={loc.id} className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {loc.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {catItems.map(item => (
                  <tr key={item.id} className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-gray-900">{item.name}</div>
                      <div className="text-xs text-gray-400">{item.uom}{item.supplier ? ` · ${item.supplier}` : ''}</div>
                    </td>
                    {locations.map(loc => {
                      const key = `${item.id}:${loc.id}`;
                      const latest = latestByKey[key];
                      const par = parByKey[key]?.par_level || 0;
                      const status = statusFor(latest?.counted_qty ?? null, par);
                      const sc = STATUS_CONFIG[status];
                      const isEditing = editingKey === key;

                      return (
                        <td key={loc.id} className="px-3 py-2.5 text-center">
                          {isEditing ? (
                            <input
                              type="number" min="0" step="any" autoFocus
                              value={draft}
                              onChange={e => setDraft(e.target.value)}
                              onBlur={() => commitEdit(item.id, loc.id)}
                              onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditingKey(null); }}
                              disabled={saving}
                              className="w-20 text-center border border-teal-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                            />
                          ) : (
                            <button
                              onClick={() => startEdit(item.id, loc.id)}
                              className={`w-20 inline-flex flex-col items-center justify-center rounded-lg border px-2 py-1 transition-colors hover:opacity-80 ${sc.bg} ${sc.border} ${sc.text}`}
                              title={par > 0 ? `Par: ${par}` : 'No par level set'}
                            >
                              <span className="font-semibold">{latest?.counted_qty ?? '—'}</span>
                              <span className="text-[10px] opacity-70">
                                {latest ? fmtDate(latest.counted_at) : sc.label}
                              </span>
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Items Tab ──────────────────────────────────────────────────────────────────

const BLANK_ITEM = { name: '', category: '', uom: 'units', supplier: '' };

function ItemsTab({ items, locations, parByKey, orgId, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState(BLANK_ITEM);
  const [parDrafts, setParDrafts] = useState({});
  const [saving, setSaving] = useState(false);

  function openAdd() {
    setEditingItem(null);
    setForm(BLANK_ITEM);
    setParDrafts({});
    setShowForm(true);
  }

  function openEdit(item) {
    setEditingItem(item);
    setForm({ name: item.name, category: item.category || '', uom: item.uom || 'units', supplier: item.supplier || '' });
    const drafts = {};
    locations.forEach(loc => {
      drafts[loc.id] = parByKey[`${item.id}:${loc.id}`]?.par_level ?? 0;
    });
    setParDrafts(drafts);
    setShowForm(true);
  }

  async function save() {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      let item = editingItem;
      if (editingItem) {
        await db.updateStockItem(editingItem.id, form);
        toast.success('Item updated');
      } else {
        item = await db.createStockItem(orgId, form);
        toast.success('Item added');
      }
      if (item) {
        await Promise.all(
          locations.map(loc =>
            db.updateParLevel(orgId, item.id, loc.id, parseFloat(parDrafts[loc.id]) || 0)
          )
        );
      }
      setShowForm(false);
      onRefresh();
    } catch (err) {
      toast.error('Failed to save item');
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function remove(itemId) {
    if (!window.confirm('Delete this item and its stocktake history?')) return;
    try {
      await db.deleteStockItem(itemId);
      toast.success('Item deleted');
      onRefresh();
    } catch (err) {
      toast.error('Failed to delete item');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{items.length} item{items.length !== 1 ? 's' : ''}</p>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium bg-teal-600 text-white hover:bg-teal-700 transition-colors"
        >
          <Plus size={14} />
          Add Item
        </button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Package size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No items yet. Add your first SKU.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-50">
          {items.map(item => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/60 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-900">{item.name}</span>
                  {item.category && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-teal-50 text-teal-700">{item.category}</span>
                  )}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {item.uom}{item.supplier ? ` · ${item.supplier}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => openEdit(item)} className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors" title="Edit">
                  <Edit2 size={13} />
                </button>
                <button onClick={() => remove(item.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <Modal title={editingItem ? 'Edit Item' : 'Add Item'} onClose={() => setShowForm(false)}>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text" value={form.name} autoFocus
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Full Cream Milk 10L"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                <input
                  type="text" value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  placeholder="e.g. Dry Goods"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">UoM</label>
                <input
                  type="text" value={form.uom}
                  onChange={e => setForm(f => ({ ...f, uom: e.target.value }))}
                  placeholder="units, kg, L…"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Supplier</label>
              <input
                type="text" value={form.supplier}
                onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))}
                placeholder="Optional"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
              />
            </div>

            {locations.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Par levels by location</label>
                <div className="grid grid-cols-2 gap-2">
                  {locations.map(loc => (
                    <div key={loc.id}>
                      <span className="text-xs text-gray-500">{loc.name}</span>
                      <input
                        type="number" min="0" step="any"
                        value={parDrafts[loc.id] ?? 0}
                        onChange={e => setParDrafts(d => ({ ...d, [loc.id]: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button onClick={save} disabled={saving} className="flex-1 px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors disabled:opacity-50">
                {saving ? 'Saving…' : editingItem ? 'Update' : 'Add Item'}
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Locations Tab ────────────────────────────────────────────────────────────

function LocationsTab({ locations, orgId, onRefresh }) {
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      await db.createLocation(orgId, name.trim());
      toast.success('Location added');
      setName('');
      setShowAdd(false);
      onRefresh();
    } catch (err) {
      toast.error('Failed to add location');
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(loc) {
    try {
      await db.updateLocation(loc.id, { active: !loc.active });
      onRefresh();
    } catch (err) {
      toast.error('Failed to update location');
    }
  }

  async function remove(locId) {
    if (!window.confirm('Delete this location and its stocktake history?')) return;
    try {
      await db.deleteLocation(locId);
      toast.success('Location deleted');
      onRefresh();
    } catch (err) {
      toast.error('Failed to delete location');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{locations.length} location{locations.length !== 1 ? 's' : ''}</p>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium bg-teal-600 text-white hover:bg-teal-700 transition-colors"
        >
          <Plus size={14} />
          Add Location
        </button>
      </div>

      {locations.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <MapPin size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No locations yet. Add your first site (e.g. "Shop", "Busstop").</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-50">
          {locations.map(loc => (
            <div key={loc.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50/60 transition-colors">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-teal-50 rounded-lg flex items-center justify-center">
                  <MapPin size={14} className="text-teal-600" />
                </div>
                <span className={`text-sm font-medium ${loc.active ? 'text-gray-900' : 'text-gray-400 line-through'}`}>{loc.name}</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => toggleActive(loc)}
                  className="px-2.5 py-1 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  {loc.active ? 'Deactivate' : 'Activate'}
                </button>
                <button onClick={() => remove(loc.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <Modal title="Add Location" onClose={() => setShowAdd(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
              <input
                autoFocus value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && add()}
                placeholder="e.g. Shop, Busstop"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={add} disabled={saving} className="flex-1 px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors disabled:opacity-50">
                {saving ? 'Adding…' : 'Add'}
              </button>
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function StockApp({ user, org }) {
  const [activeTab, setActiveTab] = useState('stocktake');
  const [locations, setLocations] = useState([]);
  const [items, setItems] = useState([]);
  const [pars, setPars] = useState([]);
  const [counts, setCounts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [org?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    if (!org?.id) return;
    setLoading(true);
    try {
      const [locs, stockItems, parRows, countRows] = await Promise.all([
        db.getLocations(org.id),
        db.getStockItems(org.id),
        db.getStockItemLocations(org.id),
        db.getLatestStockCounts(org.id),
      ]);
      setLocations(locs);
      setItems(stockItems);
      setPars(parRows);
      setCounts(countRows);
    } catch (err) {
      toast.error('Failed to load stock data');
      console.error(err);
    }
    setLoading(false);
  }

  const activeLocations = useMemo(() => locations.filter(l => l.active), [locations]);
  const activeItems = useMemo(() => items.filter(i => i.active !== false), [items]);

  const latestByKey = useMemo(() => {
    const map = {};
    counts.forEach(c => { map[`${c.item_id}:${c.location_id}`] = c; });
    return map;
  }, [counts]);

  const parByKey = useMemo(() => {
    const map = {};
    pars.forEach(p => { map[`${p.item_id}:${p.location_id}`] = p; });
    return map;
  }, [pars]);

  const alertCount = useMemo(() => {
    let n = 0;
    activeItems.forEach(item => {
      activeLocations.forEach(loc => {
        const key = `${item.id}:${loc.id}`;
        const status = statusFor(latestByKey[key]?.counted_qty ?? null, parByKey[key]?.par_level || 0);
        if (status === 'low' || status === 'out') n++;
      });
    });
    return n;
  }, [activeItems, activeLocations, latestByKey, parByKey]);

  function handleCountSaved(key, row) {
    setCounts(prev => [row, ...prev.filter(c => `${c.item_id}:${c.location_id}` !== key)]);
  }

  const TABS = [
    { id: 'stocktake', label: 'Stocktake', Icon: ClipboardList },
    { id: 'items',     label: 'Items',     Icon: Package },
    { id: 'locations', label: 'Locations', Icon: MapPin },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">R-Stock</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {activeItems.length} item{activeItems.length !== 1 ? 's' : ''} across {activeLocations.length} location{activeLocations.length !== 1 ? 's' : ''}
          </p>
        </div>
        {alertCount > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-xs font-medium text-amber-700">
            <AlertTriangle size={13} />
            {alertCount} below par
          </div>
        )}
      </div>

      <div className="flex gap-1 border-b border-gray-100">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${
              activeTab === id ? 'border-teal-600 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'stocktake' && (
        <StocktakeTab
          items={activeItems}
          locations={activeLocations}
          latestByKey={latestByKey}
          parByKey={parByKey}
          user={user}
          orgId={org.id}
          onCountSaved={handleCountSaved}
        />
      )}
      {activeTab === 'items' && (
        <ItemsTab
          items={items}
          locations={activeLocations}
          parByKey={parByKey}
          orgId={org.id}
          onRefresh={loadData}
        />
      )}
      {activeTab === 'locations' && (
        <LocationsTab
          locations={locations}
          orgId={org.id}
          onRefresh={loadData}
        />
      )}
    </div>
  );
}
