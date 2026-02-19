import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ShoppingCart, Plus, Trash2, Edit2, X, Upload,
  ChevronDown, Package, Truck, History, Settings,
  AlertTriangle, XCircle, RefreshCw,
} from 'lucide-react';
import { db } from './supabaseClient';
import toast from 'react-hot-toast';
import Papa from 'papaparse';

// ── Constants ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  in_stock:     { label: 'In Stock',     bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200', dot: 'bg-green-500'  },
  low_stock:    { label: 'Low Stock',    bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-400'  },
  no_stock:     { label: 'No Stock',     bg: 'bg-red-100',   text: 'text-red-700',   border: 'border-red-200',   dot: 'bg-red-500'    },
  order_placed: { label: 'Order Placed', bg: 'bg-blue-100',  text: 'text-blue-700',  border: 'border-blue-200',  dot: 'bg-blue-500'   },
};

const STATUS_ORDER = ['no_stock', 'low_stock', 'in_stock', 'order_placed'];

function getTomorrowDate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + 'T12:00:00').toLocaleDateString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

// ── Shared Components ──────────────────────────────────────────────────────────

function Modal({ title, onClose, children, maxWidth = 'max-w-md' }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-2xl shadow-xl w-full ${maxWidth} max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-6 py-4 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.in_stock;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ── Stocktake Tab ──────────────────────────────────────────────────────────────

function StocktakeTab({ items, distributors, onStatusChange, onQtyChange, onPlaceOrder }) {
  const [filterDist, setFilterDist] = useState('all');
  const [editingQty, setEditingQty] = useState(null); // item id being edited
  const [qtyDraft, setQtyDraft] = useState('');

  const filtered = filterDist === 'all'
    ? items
    : items.filter(i => i.distributor_id === filterDist);

  // Sort: no_stock first, then low_stock, then in_stock, then order_placed
  const sorted = [...filtered].sort((a, b) => {
    return STATUS_ORDER.indexOf(a.current_status) - STATUS_ORDER.indexOf(b.current_status);
  });

  const noStock  = items.filter(i => i.current_status === 'no_stock').length;
  const lowStock = items.filter(i => i.current_status === 'low_stock').length;
  const orderableCount = items.filter(i => i.current_status === 'no_stock' || i.current_status === 'low_stock').length;

  function startQtyEdit(item) {
    setEditingQty(item.id);
    setQtyDraft(String(item.current_qty ?? item.default_qty ?? 1));
  }

  function commitQtyEdit(item) {
    const parsed = parseFloat(qtyDraft);
    if (!isNaN(parsed) && parsed > 0) {
      onQtyChange(item.id, parsed);
    }
    setEditingQty(null);
  }

  return (
    <div className="space-y-4">
      {/* Summary banners */}
      {noStock > 0 && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <XCircle size={15} className="text-red-600 flex-shrink-0" />
          <span className="text-sm font-medium text-red-700">
            {noStock} SKU{noStock !== 1 ? 's' : ''} with no stock
          </span>
        </div>
      )}
      {lowStock > 0 && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertTriangle size={15} className="text-amber-600 flex-shrink-0" />
          <span className="text-sm font-medium text-amber-700">
            {lowStock} SKU{lowStock !== 1 ? 's' : ''} running low
          </span>
        </div>
      )}

      {/* Controls row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Distributor filter tabs */}
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl flex-wrap">
          <button
            onClick={() => setFilterDist('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${filterDist === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            All
          </button>
          {distributors.map(d => (
            <button
              key={d.id}
              onClick={() => setFilterDist(d.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${filterDist === d.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {d.name}
            </button>
          ))}
        </div>

        {/* Place Order CTA */}
        <button
          onClick={onPlaceOrder}
          disabled={orderableCount === 0}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            orderableCount > 0
              ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          <ShoppingCart size={15} />
          Place Order
          {orderableCount > 0 && (
            <span className="bg-white/20 text-white text-xs px-1.5 py-0.5 rounded-full">
              {orderableCount}
            </span>
          )}
        </button>
      </div>

      {/* Table */}
      {sorted.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Package size={36} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No items yet. Add SKUs in Settings.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">SKU</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Distributor</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Qty</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">UoM</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sorted.map(item => {
                const qty = item.current_qty ?? item.default_qty ?? 1;
                const distName = distributors.find(d => d.id === item.distributor_id)?.name ?? '—';
                const isEditing = editingQty === item.id;
                const qtyHighlight = qty > 1;

                return (
                  <tr key={item.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{item.sku}</td>
                    <td className="px-4 py-3 text-gray-500">{distName}</td>
                    <td className="px-4 py-3 text-center">
                      {isEditing ? (
                        <input
                          type="number"
                          min="0.01"
                          step="any"
                          autoFocus
                          value={qtyDraft}
                          onChange={e => setQtyDraft(e.target.value)}
                          onBlur={() => commitQtyEdit(item)}
                          onKeyDown={e => { if (e.key === 'Enter') commitQtyEdit(item); if (e.key === 'Escape') setEditingQty(null); }}
                          className="w-16 text-center border border-blue-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                        />
                      ) : (
                        <button
                          onClick={() => startQtyEdit(item)}
                          className={`inline-flex items-center justify-center min-w-[2.5rem] px-2 py-1 rounded-lg font-semibold transition-colors hover:bg-gray-100 ${
                            qtyHighlight ? 'text-amber-700 bg-amber-50' : 'text-gray-700'
                          }`}
                          title="Click to edit quantity"
                        >
                          {qty}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{item.uom}</td>
                    <td className="px-4 py-3">
                      <StatusDropdown
                        value={item.current_status}
                        onChange={status => onStatusChange(item.id, status)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
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
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all hover:opacity-80 ${cfg.bg} ${cfg.text} ${cfg.border}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
        {cfg.label}
        <ChevronDown size={11} className="ml-0.5 opacity-60" />
      </button>
      {open && (
        <div className="absolute left-0 mt-1.5 bg-white rounded-xl shadow-lg border border-gray-100 z-20 overflow-hidden min-w-[140px]">
          {Object.entries(STATUS_CONFIG).map(([key, s]) => (
            <button
              key={key}
              onClick={() => { onChange(key); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors hover:bg-gray-50 ${key === value ? 'bg-gray-50' : ''}`}
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

// ── Place Order Modal ──────────────────────────────────────────────────────────

function PlaceOrderModal({ items, distributors, onConfirm, onClose }) {
  const orderable = items.filter(i => i.current_status === 'no_stock' || i.current_status === 'low_stock');
  const [deliveryDate, setDeliveryDate] = useState(getTomorrowDate());
  const [notes, setNotes] = useState('');
  const [quantities, setQuantities] = useState(
    Object.fromEntries(orderable.map(i => [i.id, i.current_qty ?? i.default_qty ?? 1]))
  );

  // Group by distributor for display
  const byDistributor = distributors.reduce((acc, d) => {
    const distItems = orderable.filter(i => i.distributor_id === d.id);
    if (distItems.length > 0) acc.push({ dist: d, items: distItems });
    return acc;
  }, []);

  // Items with no distributor assigned
  const noDistItems = orderable.filter(i => !i.distributor_id || !distributors.find(d => d.id === i.distributor_id));
  if (noDistItems.length > 0) {
    byDistributor.push({ dist: { id: null, name: 'No Distributor' }, items: noDistItems });
  }

  function handleConfirm() {
    const orderItems = orderable.map(i => ({
      item_id:          i.id,
      sku:              i.sku,
      qty:              quantities[i.id] ?? (i.current_qty ?? i.default_qty ?? 1),
      uom:              i.uom,
      distributor_name: distributors.find(d => d.id === i.distributor_id)?.name ?? null,
    }));
    onConfirm({ deliveryDate, notes, items: orderItems });
  }

  return (
    <Modal title="Place Order" onClose={onClose} maxWidth="max-w-lg">
      <div className="space-y-5">
        {orderable.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">No items need ordering right now.</p>
        ) : (
          <>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Expected Delivery Date
              </label>
              <input
                type="date"
                value={deliveryDate}
                onChange={e => setDeliveryDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>

            <div className="space-y-4">
              {byDistributor.map(({ dist, items: distItems }) => (
                <div key={dist.id ?? 'none'}>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <Truck size={12} />
                    {dist.name}
                  </h3>
                  <div className="bg-gray-50 rounded-xl overflow-hidden divide-y divide-gray-100">
                    {distItems.map(item => (
                      <div key={item.id} className="flex items-center justify-between px-3 py-2.5">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{item.sku}</p>
                          <StatusPill status={item.current_status} />
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            value={quantities[item.id] ?? ''}
                            onChange={e => setQuantities(q => ({ ...q, [item.id]: parseFloat(e.target.value) || '' }))}
                            className="w-16 text-center border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                          />
                          <span className="text-xs text-gray-400 w-10">{item.uom}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any special instructions..."
                rows={2}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>

            <button
              onClick={handleConfirm}
              className="w-full bg-blue-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              Confirm Order · Delivery {fmtDate(deliveryDate)}
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}

// ── Order History Tab ──────────────────────────────────────────────────────────

function HistoryTab({ history, distributors }) {
  if (history.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400">
        <History size={36} className="mx-auto mb-3 opacity-40" />
        <p className="text-sm">No orders placed yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {history.map(record => {
        // Group items by distributor_name for display
        const distGroups = record.items.reduce((acc, item) => {
          const key = item.distributor_name || 'No Distributor';
          if (!acc[key]) acc[key] = [];
          acc[key].push(item);
          return acc;
        }, {});

        return (
          <div key={record.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  Ordered {fmtDate(record.placed_at?.slice(0, 10))}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Delivery: {fmtDate(record.delivery_date)} · {record.items.length} SKU{record.items.length !== 1 ? 's' : ''}
                </p>
              </div>
              <span className="text-xs text-blue-600 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-full font-medium">
                {Object.keys(distGroups).length} supplier{Object.keys(distGroups).length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="divide-y divide-gray-50">
              {Object.entries(distGroups).map(([distName, distItems]) => (
                <div key={distName} className="px-5 py-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <Truck size={11} />
                    {distName}
                  </p>
                  <div className="space-y-1">
                    {distItems.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">{item.sku}</span>
                        <span className="text-gray-500 font-medium">
                          {item.qty} {item.uom}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {record.notes && (
              <div className="px-5 py-3 bg-gray-50 text-xs text-gray-500 border-t border-gray-100">
                {record.notes}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Settings Tab ───────────────────────────────────────────────────────────────

function SettingsTab({ items, distributors, onRefresh }) {
  const [subTab, setSubTab] = useState('items'); // 'items' | 'distributors'
  const [showAddItem, setShowAddItem] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [showAddDist, setShowAddDist] = useState(false);
  const [showCsvImport, setShowCsvImport] = useState(false);

  return (
    <div className="space-y-4">
      {/* Sub-tab switcher */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setSubTab('items')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${subTab === 'items' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          SKU List
        </button>
        <button
          onClick={() => setSubTab('distributors')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${subTab === 'distributors' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Distributors
        </button>
      </div>

      {subTab === 'items' && (
        <ItemsSettings
          items={items}
          distributors={distributors}
          showAddItem={showAddItem}
          setShowAddItem={setShowAddItem}
          editingItem={editingItem}
          setEditingItem={setEditingItem}
          showCsvImport={showCsvImport}
          setShowCsvImport={setShowCsvImport}
          onRefresh={onRefresh}
        />
      )}
      {subTab === 'distributors' && (
        <DistributorsSettings
          distributors={distributors}
          showAddDist={showAddDist}
          setShowAddDist={setShowAddDist}
          onRefresh={onRefresh}
        />
      )}
    </div>
  );
}

function ItemsSettings({ items, distributors, showAddItem, setShowAddItem, editingItem, setEditingItem, showCsvImport, setShowCsvImport, onRefresh }) {
  async function handleDelete(itemId) {
    if (!window.confirm('Remove this SKU from the list?')) return;
    try {
      await db.deleteOrderingItem(itemId);
      onRefresh();
      toast.success('SKU removed');
    } catch (err) {
      toast.error('Failed to remove SKU');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{items.length} SKU{items.length !== 1 ? 's' : ''}</p>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCsvImport(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Upload size={14} />
            Import CSV
          </button>
          <button
            onClick={() => { setEditingItem(null); setShowAddItem(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            <Plus size={14} />
            Add SKU
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Package size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No SKUs yet. Add one or import a CSV.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">SKU</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Default Qty</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">UoM</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Distributor</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map(item => (
                <tr key={item.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{item.sku}</td>
                  <td className="px-4 py-3 text-gray-600">{item.default_qty}</td>
                  <td className="px-4 py-3 text-gray-500">{item.uom}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {distributors.find(d => d.id === item.distributor_id)?.name ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => { setEditingItem(item); setShowAddItem(true); }}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAddItem && (
        <ItemFormModal
          item={editingItem}
          distributors={distributors}
          onClose={() => { setShowAddItem(false); setEditingItem(null); }}
          onSave={onRefresh}
        />
      )}

      {showCsvImport && (
        <CsvImportModal
          distributors={distributors}
          onClose={() => setShowCsvImport(false)}
          onSave={onRefresh}
        />
      )}
    </div>
  );
}

function DistributorsSettings({ distributors, showAddDist, setShowAddDist, onRefresh }) {
  async function handleDelete(distId) {
    if (!window.confirm('Remove this distributor? Items assigned to it will be unlinked.')) return;
    try {
      await db.deleteOrderingDistributor(distId);
      onRefresh();
      toast.success('Distributor removed');
    } catch (err) {
      toast.error('Failed to remove distributor');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{distributors.length} distributor{distributors.length !== 1 ? 's' : ''}</p>
        <button
          onClick={() => setShowAddDist(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          <Plus size={14} />
          Add Distributor
        </button>
      </div>

      {distributors.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Truck size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No distributors yet. Add your supply base here.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
          {distributors.map(d => (
            <div key={d.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50/60 transition-colors">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Truck size={14} className="text-blue-500" />
                </div>
                <span className="text-sm font-medium text-gray-900">{d.name}</span>
              </div>
              <button
                onClick={() => handleDelete(d.id)}
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {showAddDist && (
        <AddDistributorModal
          onClose={() => setShowAddDist(false)}
          onSave={onRefresh}
        />
      )}
    </div>
  );
}

// ── Form Modals ────────────────────────────────────────────────────────────────

function ItemFormModal({ item, distributors, onClose, onSave }) {
  const { user } = useOrderingUser();
  const [sku, setSku]           = useState(item?.sku ?? '');
  const [qty, setQty]           = useState(String(item?.default_qty ?? 1));
  const [uom, setUom]           = useState(item?.uom ?? 'units');
  const [distId, setDistId]     = useState(item?.distributor_id ?? '');
  const [saving, setSaving]     = useState(false);

  async function handleSave() {
    if (!sku.trim()) { toast.error('SKU name is required'); return; }
    const parsedQty = parseFloat(qty);
    if (isNaN(parsedQty) || parsedQty <= 0) { toast.error('Quantity must be a positive number'); return; }

    setSaving(true);
    try {
      const payload = {
        sku: sku.trim(),
        default_qty: parsedQty,
        uom: uom.trim() || 'units',
        distributor_id: distId || null,
      };
      if (item?.id) {
        await db.updateOrderingItem(item.id, payload);
        toast.success('SKU updated');
      } else {
        await db.createOrderingItem(user.id, payload);
        toast.success('SKU added');
      }
      onSave();
      onClose();
    } catch (err) {
      toast.error('Failed to save SKU');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={item ? 'Edit SKU' : 'Add SKU'} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">SKU Name</label>
          <input
            value={sku}
            onChange={e => setSku(e.target.value)}
            placeholder="e.g. Full Cream Milk 10L"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Default Qty</label>
            <input
              type="number"
              min="0.01"
              step="any"
              value={qty}
              onChange={e => setQty(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">UoM</label>
            <input
              value={uom}
              onChange={e => setUom(e.target.value)}
              placeholder="e.g. cases, kg, units"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Distributor</label>
          <select
            value={distId}
            onChange={e => setDistId(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
          >
            <option value="">— None —</option>
            {distributors.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2 text-sm font-medium hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} className="flex-1 bg-blue-600 text-white rounded-xl py-2 text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50">
            {saving ? 'Saving…' : item ? 'Save Changes' : 'Add SKU'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function AddDistributorModal({ onClose, onSave }) {
  const { user } = useOrderingUser();
  const [name, setName]     = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) { toast.error('Distributor name is required'); return; }
    setSaving(true);
    try {
      await db.createOrderingDistributor(user.id, name.trim());
      toast.success('Distributor added');
      onSave();
      onClose();
    } catch (err) {
      toast.error('Failed to add distributor');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Add Distributor" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Name</label>
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            placeholder="e.g. PFD Food Services"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2 text-sm font-medium hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} className="flex-1 bg-blue-600 text-white rounded-xl py-2 text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50">
            {saving ? 'Saving…' : 'Add'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── CSV Import Modal ───────────────────────────────────────────────────────────

function CsvImportModal({ distributors, onClose, onSave }) {
  const { user } = useOrderingUser();
  const [preview, setPreview] = useState(null); // parsed rows
  const [error, setError]     = useState(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef(null);

  function handleFile(file) {
    if (!file) return;
    setError(null);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        const rows = results.data;
        // Expect columns: SKU, Qty, uOm, Distributor (case-insensitive)
        const normalised = rows.map((r, idx) => {
          const keys = Object.keys(r).reduce((acc, k) => { acc[k.toLowerCase().trim()] = r[k]; return acc; }, {});
          return {
            sku:         (keys['sku'] || keys['name'] || '').toString().trim(),
            default_qty: parseFloat(keys['qty'] || keys['quantity'] || '1') || 1,
            uom:         (keys['uom'] || keys['uom '] || keys['unit'] || keys['units'] || 'units').toString().trim(),
            distributor: (keys['distributor'] || '').toString().trim(),
            _rowNum:     idx + 2,
          };
        }).filter(r => r.sku);

        if (normalised.length === 0) {
          setError('No valid rows found. Ensure your CSV has a "SKU" column.');
          return;
        }
        setPreview(normalised);
      },
      error(err) {
        setError('Could not parse CSV: ' + err.message);
      },
    });
  }

  async function handleImport() {
    if (!preview) return;
    setImporting(true);
    try {
      // Resolve distributor IDs (match by name, case-insensitive)
      // Collect unique distributor names that are new → create them
      const uniqueDistNames = [...new Set(preview.map(r => r.distributor).filter(Boolean))];
      const distMap = {}; // name (lower) → id
      distributors.forEach(d => { distMap[d.name.toLowerCase()] = d.id; });

      for (const name of uniqueDistNames) {
        const key = name.toLowerCase();
        if (!distMap[key]) {
          const newDist = await db.createOrderingDistributor(user.id, name);
          distMap[key] = newDist.id;
        }
      }

      const itemsToCreate = preview.map(r => ({
        sku:           r.sku,
        default_qty:   r.default_qty,
        uom:           r.uom,
        distributor_id: r.distributor ? (distMap[r.distributor.toLowerCase()] || null) : null,
      }));

      await db.bulkCreateOrderingItems(user.id, itemsToCreate);
      toast.success(`Imported ${itemsToCreate.length} SKUs`);
      onSave();
      onClose();
    } catch (err) {
      toast.error('Import failed: ' + (err.message || 'Unknown error'));
    } finally {
      setImporting(false);
    }
  }

  return (
    <Modal title="Import SKUs from CSV" onClose={onClose} maxWidth="max-w-lg">
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700 space-y-1">
          <p className="font-semibold">Expected columns:</p>
          <p><code className="bg-blue-100 px-1 rounded">SKU</code>, <code className="bg-blue-100 px-1 rounded">Qty</code>, <code className="bg-blue-100 px-1 rounded">uOm</code>, <code className="bg-blue-100 px-1 rounded">Distributor</code></p>
          <p className="text-blue-500">New distributors will be created automatically.</p>
        </div>

        {!preview ? (
          <div
            className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
          >
            <Upload size={24} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm text-gray-500">Drop your CSV here or <span className="text-blue-600 font-medium">browse</span></p>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => handleFile(e.target.files[0])} />
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-600 mb-2 font-medium">{preview.length} rows ready to import</p>
            <div className="bg-gray-50 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-100">
                  <tr>
                    <th className="text-left px-3 py-2 text-gray-500">SKU</th>
                    <th className="text-left px-3 py-2 text-gray-500">Qty</th>
                    <th className="text-left px-3 py-2 text-gray-500">UoM</th>
                    <th className="text-left px-3 py-2 text-gray-500">Distributor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {preview.map((r, i) => (
                    <tr key={i}>
                      <td className="px-3 py-1.5 font-medium text-gray-800">{r.sku}</td>
                      <td className="px-3 py-1.5 text-gray-600">{r.default_qty}</td>
                      <td className="px-3 py-1.5 text-gray-600">{r.uom}</td>
                      <td className="px-3 py-1.5 text-gray-500">{r.distributor || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              onClick={() => setPreview(null)}
              className="mt-2 text-xs text-gray-400 hover:text-gray-600"
            >
              Choose a different file
            </button>
          </div>
        )}

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2 text-sm font-medium hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!preview || importing}
            className="flex-1 bg-blue-600 text-white rounded-xl py-2 text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-40"
          >
            {importing ? 'Importing…' : `Import ${preview?.length ?? 0} SKUs`}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Context for passing user down without prop-drilling ────────────────────────

const OrderingUserContext = React.createContext(null);
function useOrderingUser() { return React.useContext(OrderingUserContext); }

// ── Main OrderingApp ───────────────────────────────────────────────────────────

export default function OrderingApp({ user }) {
  const [activeTab, setActiveTab]         = useState('stocktake');
  const [distributors, setDistributors]   = useState([]);
  const [items, setItems]                 = useState([]);
  const [history, setHistory]             = useState([]);
  const [loading, setLoading]             = useState(true);
  const [showPlaceOrder, setShowPlaceOrder] = useState(false);

  const load = useCallback(async () => {
    try {
      const [dists, itms, hist] = await Promise.all([
        db.getOrderingDistributors(user.id),
        db.getOrderingItems(user.id),
        db.getOrderHistory(user.id),
      ]);
      setDistributors(dists);
      setItems(itms);
      setHistory(hist);
    } catch (err) {
      toast.error('Failed to load ordering data');
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => { load(); }, [load]);

  async function handleStatusChange(itemId, newStatus) {
    // Optimistic update
    setItems(prev => prev.map(i => i.id === itemId
      ? { ...i, current_status: newStatus, status_updated_at: new Date().toISOString() }
      : i
    ));
    try {
      await db.updateOrderingItemStatus(itemId, newStatus);
    } catch (err) {
      toast.error('Failed to update status');
      load(); // Revert on failure
    }
  }

  async function handleQtyChange(itemId, newQty) {
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, current_qty: newQty } : i));
    try {
      await db.updateOrderingItemQty(itemId, newQty);
    } catch (err) {
      toast.error('Failed to update quantity');
      load();
    }
  }

  async function handlePlaceOrder({ deliveryDate, notes, items: orderItems }) {
    try {
      await db.createOrderHistoryRecord(user.id, {
        delivery_date: deliveryDate,
        notes: notes || null,
        items: orderItems,
      });
      // Mark those items as order_placed
      const itemIds = orderItems.map(i => i.item_id);
      await Promise.all(itemIds.map(id => db.updateOrderingItemStatus(id, 'order_placed')));
      toast.success('Order placed — delivery ' + fmtDate(deliveryDate));
      setShowPlaceOrder(false);
      load();
    } catch (err) {
      toast.error('Failed to place order');
    }
  }

  const TABS = [
    { id: 'stocktake', label: 'Stocktake',     icon: ShoppingCart },
    { id: 'history',   label: 'Order History', icon: History      },
    { id: 'settings',  label: 'Settings',      icon: Settings     },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw size={20} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <OrderingUserContext.Provider value={{ user }}>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Ordering</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              {items.length} SKU{items.length !== 1 ? 's' : ''} across {distributors.length} distributor{distributors.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-100">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {activeTab === 'stocktake' && (
          <StocktakeTab
            items={items}
            distributors={distributors}
            onStatusChange={handleStatusChange}
            onQtyChange={handleQtyChange}
            onPlaceOrder={() => setShowPlaceOrder(true)}
          />
        )}
        {activeTab === 'history' && (
          <HistoryTab history={history} distributors={distributors} />
        )}
        {activeTab === 'settings' && (
          <SettingsTab items={items} distributors={distributors} onRefresh={load} />
        )}

        {showPlaceOrder && (
          <PlaceOrderModal
            items={items}
            distributors={distributors}
            onConfirm={handlePlaceOrder}
            onClose={() => setShowPlaceOrder(false)}
          />
        )}
      </div>
    </OrderingUserContext.Provider>
  );
}
