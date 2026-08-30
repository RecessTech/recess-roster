import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Package, Plus, Trash2, Edit2, X, MapPin, Upload,
  ClipboardList, AlertTriangle, XCircle, ChevronDown, Truck,
} from 'lucide-react';
import { db } from './supabaseClient';
import toast from 'react-hot-toast';
import Papa from 'papaparse';

// ── Constants ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  no_stock:  { label: 'No Stock',              bg: 'bg-red-100',   text: 'text-red-700',   border: 'border-red-200',   dot: 'bg-red-500'   },
  low_stock: { label: 'Low Stock',              bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-400' },
  order_moq: { label: 'Order if MOQ Required',  bg: 'bg-purple-100',text: 'text-purple-700',border: 'border-purple-200',dot: 'bg-purple-500'},
  in_stock:  { label: 'In Stock',               bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200', dot: 'bg-green-500' },
};

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

function StatusDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e) { if (!ref.current?.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const cfg = STATUS_CONFIG[value] || STATUS_CONFIG.in_stock;

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all hover:opacity-80 whitespace-nowrap ${cfg.bg} ${cfg.text} ${cfg.border}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
        {cfg.label}
        <ChevronDown size={11} className="ml-0.5 opacity-60 flex-shrink-0" />
      </button>
      {open && (
        <div className="absolute left-0 mt-1.5 bg-white rounded-xl shadow-lg border border-gray-100 z-20 overflow-hidden min-w-[190px]">
          {Object.entries(STATUS_CONFIG).map(([key, s]) => (
            <button
              key={key}
              onClick={() => { onChange(key); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors hover:bg-gray-50 text-left ${key === value ? 'bg-gray-50' : ''}`}
            >
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Stocktake Tab ─────────────────────────────────────────────────────────────

function StocktakeTab({ items, locations, selectedLocationId, onSelectLocation, onUpdate }) {
  const [qtyEditing, setQtyEditing] = useState(null);
  const [qtyDraft, setQtyDraft] = useState('');

  const locationItems = useMemo(
    () => items.filter(i => i.location_id === selectedLocationId),
    [items, selectedLocationId]
  );

  const grouped = useMemo(() => {
    const groups = {};
    for (const item of locationItems) {
      const supplier = item.supplier || 'No Supplier';
      (groups[supplier] = groups[supplier] || []).push(item);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [locationItems]);

  const noStock  = locationItems.filter(i => i.current_status === 'no_stock').length;
  const lowStock = locationItems.filter(i => i.current_status === 'low_stock').length;

  function startQtyEdit(item) {
    setQtyEditing(item.id);
    setQtyDraft(String(item.order_qty ?? item.reference_order_qty ?? 0));
  }

  function commitQtyEdit(item) {
    setQtyEditing(null);
    const parsed = parseFloat(qtyDraft);
    if (isNaN(parsed) || parsed < 0) return;
    if ((item.order_qty ?? item.reference_order_qty ?? 0) === parsed) return;
    onUpdate(item.id, { order_qty: parsed });
  }

  if (locations.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400">
        <MapPin size={32} className="mx-auto mb-3 opacity-40" />
        <p className="text-sm mb-1">No locations set up yet.</p>
        <p className="text-xs">Add a site in the Locations tab first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {locations.length > 1 && (
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
          {locations.map(loc => (
            <button
              key={loc.id}
              onClick={() => onSelectLocation(loc.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${selectedLocationId === loc.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {loc.name}
            </button>
          ))}
        </div>
      )}

      {noStock > 0 && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <XCircle size={15} className="text-red-600 flex-shrink-0" />
          <span className="text-sm font-medium text-red-700">{noStock} item{noStock !== 1 ? 's' : ''} with no stock</span>
        </div>
      )}
      {lowStock > 0 && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertTriangle size={15} className="text-amber-600 flex-shrink-0" />
          <span className="text-sm font-medium text-amber-700">{lowStock} item{lowStock !== 1 ? 's' : ''} running low</span>
        </div>
      )}

      {locationItems.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Package size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No items at this location yet. Add or upload some in the Items tab.</p>
        </div>
      ) : (
        grouped.map(([supplier, supplierItems]) => (
          <div key={supplier}>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Truck size={12} />
              {supplier}
            </h3>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Item</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Order Qty</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Ordered</th>
                  </tr>
                </thead>
                <tbody>
                  {supplierItems.map(item => {
                    const isEditing = qtyEditing === item.id;
                    const qty = item.order_qty ?? item.reference_order_qty ?? 0;
                    return (
                      <tr key={item.id} className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50/60 transition-colors">
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-gray-900">{item.name}</div>
                          <div className="text-xs text-gray-400">{item.sku} · {item.uom}</div>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {isEditing ? (
                            <input
                              type="number" min="0" step="any" autoFocus
                              value={qtyDraft}
                              onChange={e => setQtyDraft(e.target.value)}
                              onBlur={() => commitQtyEdit(item)}
                              onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setQtyEditing(null); }}
                              className="w-20 text-center border border-teal-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                            />
                          ) : (
                            <button
                              onClick={() => startQtyEdit(item)}
                              className="w-20 inline-flex items-center justify-center px-2 py-1 rounded-lg font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
                              title="Click to edit"
                            >
                              {qty} {item.uom}
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <StatusDropdown
                            value={item.current_status}
                            onChange={status => onUpdate(item.id, { current_status: status })}
                          />
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={!!item.ordered}
                            onChange={e => onUpdate(item.id, { ordered: e.target.checked })}
                            className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-400 cursor-pointer"
                            title={item.ordered_at ? `Ordered ${new Date(item.ordered_at).toLocaleDateString('en-AU')}` : 'Confirm ordered for next delivery'}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ── CSV Import Modal ───────────────────────────────────────────────────────────

function CsvImportModal({ orgId, locations, defaultLocationId, onClose, onSave }) {
  const [locationId, setLocationId] = useState(defaultLocationId || locations[0]?.id || '');
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef(null);

  function handleFile(file) {
    if (!file) return;
    setError(null);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        const normalised = results.data.map(r => {
          const keys = Object.keys(r).reduce((acc, k) => { acc[k.toLowerCase().trim()] = r[k]; return acc; }, {});
          return {
            name:                (keys['item'] || keys['name'] || '').toString().trim(),
            reference_order_qty: parseFloat(keys['qty'] || keys['quantity'] || '0') || 0,
            uom:                 (keys['uom'] || keys['unit'] || 'units').toString().trim(),
            supplier:            (keys['supplier'] || '').toString().trim(),
          };
        }).filter(r => r.name);

        if (normalised.length === 0) {
          setError('No valid rows found. Ensure your CSV has an "Item" column.');
          return;
        }
        setPreview(normalised);
      },
      error(err) { setError('Could not parse CSV: ' + err.message); },
    });
  }

  async function handleImport() {
    if (!preview || !locationId) return;
    setImporting(true);
    try {
      await db.bulkCreateStockItems(orgId, locationId, preview);
      toast.success(`Imported ${preview.length} items`);
      onSave();
      onClose();
    } catch (err) {
      toast.error('Import failed: ' + (err.message || 'Unknown error'));
    } finally {
      setImporting(false);
    }
  }

  return (
    <Modal title="Bulk Upload Items" onClose={onClose} maxWidth="max-w-lg">
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Location</label>
          <select
            value={locationId}
            onChange={e => setLocationId(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 bg-white"
          >
            {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
          </select>
          <p className="text-xs text-gray-400 mt-1">Every uploaded row is added to this site's list.</p>
        </div>

        <div className="bg-teal-50 border border-teal-100 rounded-xl p-3 text-xs text-teal-700 space-y-1">
          <p className="font-semibold">Expected columns:</p>
          <p><code className="bg-teal-100 px-1 rounded">Item</code>, <code className="bg-teal-100 px-1 rounded">Qty</code>, <code className="bg-teal-100 px-1 rounded">uOm</code>, <code className="bg-teal-100 px-1 rounded">Supplier</code></p>
          <p className="text-teal-500">SKU is assigned automatically — any SKU column in the file is ignored.</p>
        </div>

        {!preview ? (
          <div
            className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-teal-300 hover:bg-teal-50/30 transition-colors"
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
          >
            <Upload size={24} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm text-gray-500">Drop your CSV here or <span className="text-teal-600 font-medium">browse</span></p>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => handleFile(e.target.files[0])} />
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-600 mb-2 font-medium">{preview.length} rows ready to import</p>
            <div className="bg-gray-50 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-100">
                  <tr>
                    <th className="text-left px-3 py-2 text-gray-500">Item</th>
                    <th className="text-left px-3 py-2 text-gray-500">Qty</th>
                    <th className="text-left px-3 py-2 text-gray-500">uOm</th>
                    <th className="text-left px-3 py-2 text-gray-500">Supplier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {preview.map((r, i) => (
                    <tr key={i}>
                      <td className="px-3 py-1.5 font-medium text-gray-800">{r.name}</td>
                      <td className="px-3 py-1.5 text-gray-600">{r.reference_order_qty}</td>
                      <td className="px-3 py-1.5 text-gray-600">{r.uom}</td>
                      <td className="px-3 py-1.5 text-gray-500">{r.supplier || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={() => setPreview(null)} className="mt-2 text-xs text-gray-400 hover:text-gray-600">
              Choose a different file
            </button>
          </div>
        )}

        {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2 text-sm font-medium hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!preview || !locationId || importing}
            className="flex-1 bg-teal-600 text-white rounded-xl py-2 text-sm font-semibold hover:bg-teal-700 transition-colors disabled:opacity-40"
          >
            {importing ? 'Importing…' : `Import ${preview?.length ?? 0} items`}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Items Tab ──────────────────────────────────────────────────────────────────

const BLANK_ITEM = { name: '', location_id: '', uom: 'units', supplier: '', reference_order_qty: 0 };

function ItemsTab({ items, locations, orgId, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState(BLANK_ITEM);
  const [saving, setSaving] = useState(false);

  const locationName = id => locations.find(l => l.id === id)?.name || '—';

  function openAdd() {
    setEditingItem(null);
    setForm({ ...BLANK_ITEM, location_id: locations[0]?.id || '' });
    setShowForm(true);
  }

  function openEdit(item) {
    setEditingItem(item);
    setForm({
      name: item.name,
      location_id: item.location_id || '',
      uom: item.uom || 'units',
      supplier: item.supplier || '',
      reference_order_qty: item.reference_order_qty ?? 0,
    });
    setShowForm(true);
  }

  async function save() {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    if (!form.location_id) { toast.error('Location is required'); return; }
    setSaving(true);
    try {
      const payload = { ...form, reference_order_qty: parseFloat(form.reference_order_qty) || 0 };
      if (editingItem) {
        await db.updateStockItem(editingItem.id, payload);
        toast.success('Item updated');
      } else {
        await db.createStockItem(orgId, payload);
        toast.success('Item added');
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
    if (!window.confirm('Delete this item?')) return;
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
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-gray-500">{items.length} item{items.length !== 1 ? 's' : ''}</p>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCsvImport(true)}
            disabled={locations.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40"
          >
            <Upload size={14} />
            Bulk Upload
          </button>
          <button
            onClick={openAdd}
            disabled={locations.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium bg-teal-600 text-white hover:bg-teal-700 transition-colors disabled:opacity-40"
          >
            <Plus size={14} />
            Add Item
          </button>
        </div>
      </div>

      {locations.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <MapPin size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">Add a location before adding items.</p>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Package size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No items yet. Add one or bulk-upload a CSV.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-50">
          {items.map(item => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/60 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{item.sku}</span>
                  <span className="text-sm font-medium text-gray-900">{item.name}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 flex items-center gap-1">
                    <MapPin size={10} />{locationName(item.location_id)}
                  </span>
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {item.uom}{item.supplier ? ` · ${item.supplier}` : ''} · ref order qty {item.reference_order_qty}
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
            {editingItem && (
              <div className="text-xs text-gray-400">SKU: <span className="font-mono">{editingItem.sku}</span></div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text" value={form.name} autoFocus
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Full Cream Milk 10L"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Location *</label>
              <select
                value={form.location_id}
                onChange={e => setForm(f => ({ ...f, location_id: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 bg-white"
              >
                {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">UoM</label>
                <input
                  type="text" value={form.uom}
                  onChange={e => setForm(f => ({ ...f, uom: e.target.value }))}
                  placeholder="units, kg, L…"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Ref. Order Qty</label>
                <input
                  type="number" min="0" step="any" value={form.reference_order_qty}
                  onChange={e => setForm(f => ({ ...f, reference_order_qty: e.target.value }))}
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

      {showCsvImport && (
        <CsvImportModal
          orgId={orgId}
          locations={locations}
          onClose={() => setShowCsvImport(false)}
          onSave={onRefresh}
        />
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
    if (!window.confirm('Delete this location and its items?')) return;
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
          <p className="text-sm">No locations yet. Add your first site (e.g. "Crown St", "Bourke St").</p>
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
                placeholder="e.g. Crown St, Bourke St"
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
  const [loading, setLoading] = useState(true);
  const [selectedLocationId, setSelectedLocationId] = useState(null);

  useEffect(() => { loadData(); }, [org?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    if (!org?.id) return;
    setLoading(true);
    try {
      const [locs, stockItems] = await Promise.all([
        db.getLocations(org.id),
        db.getStockItems(org.id),
      ]);
      setLocations(locs);
      setItems(stockItems);
      setSelectedLocationId(prev => prev && locs.some(l => l.id === prev) ? prev : (locs.find(l => l.active)?.id || locs[0]?.id || null));
    } catch (err) {
      toast.error('Failed to load stock data');
      console.error(err);
    }
    setLoading(false);
  }

  const activeLocations = useMemo(() => locations.filter(l => l.active), [locations]);

  async function handleItemUpdate(itemId, patch) {
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, ...patch } : i));
    try {
      if ('order_qty' in patch) await db.updateStockItemOrderQty(itemId, patch.order_qty);
      if ('current_status' in patch) await db.updateStockItemStatus(itemId, patch.current_status);
      if ('ordered' in patch) {
        const row = await db.updateStockItemOrdered(itemId, patch.ordered);
        setItems(prev => prev.map(i => i.id === itemId ? { ...i, ordered_at: row.ordered_at } : i));
      }
    } catch (err) {
      toast.error('Failed to save change');
      console.error(err);
      loadData();
    }
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
            {items.length} item{items.length !== 1 ? 's' : ''} across {activeLocations.length} location{activeLocations.length !== 1 ? 's' : ''}
          </p>
        </div>
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
          items={items}
          locations={activeLocations}
          selectedLocationId={selectedLocationId}
          onSelectLocation={setSelectedLocationId}
          onUpdate={handleItemUpdate}
        />
      )}
      {activeTab === 'items' && (
        <ItemsTab
          items={items}
          locations={activeLocations}
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
