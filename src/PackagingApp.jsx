import React, { useState, useEffect, useMemo } from 'react';
import {
  Package, Plus, Trash2, Edit2, RefreshCw, X, Download,
  AlertTriangle, CheckCircle, XCircle, Info,
  ClipboardList, Settings, Truck, TrendingDown, BarChart2, GripVertical,
} from 'lucide-react';
import { db } from './supabaseClient';
import { fetchPackagingData } from './sheetsData';
import toast from 'react-hot-toast';

// ── Constants ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  ok:       { bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-700',  bar: 'bg-green-500',  label: 'OK'       },
  warning:  { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  bar: 'bg-amber-400',  label: 'Low'      },
  critical: { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700',    bar: 'bg-red-500',    label: 'Critical' },
  unknown:  { bg: 'bg-gray-50',   border: 'border-gray-200',   text: 'text-gray-500',   bar: 'bg-gray-300',   label: 'No data'  },
};

const PRESET_COLORS = [
  '#6366f1', '#f97316', '#22c55e', '#ef4444',
  '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
  '#14b8a6', '#64748b',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n) {
  if (n === null || n === undefined) return '—';
  return Math.round(n).toLocaleString();
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + 'T12:00:00').toLocaleDateString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function daysBetween(dateStr) {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr + 'T12:00:00')) / 86400000);
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

// ── Dashboard Tab ─────────────────────────────────────────────────────────────

function DashboardTab({ itemStatuses, sheetData, sheetSettings, onAddEvent, onSyncSheet, loadingSheet }) {
  const critical = itemStatuses.filter(i => i.status === 'critical');
  const warning  = itemStatuses.filter(i => i.status === 'warning');

  return (
    <div className="space-y-5">
      {/* Alert banners */}
      {critical.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <XCircle size={16} className="text-red-600 flex-shrink-0" />
            <span className="text-sm font-semibold text-red-700">
              {critical.length} item{critical.length !== 1 ? 's' : ''} need reordering now
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {critical.map(item => (
              <span
                key={item.id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-100 text-red-700 text-xs rounded-full font-medium"
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                {item.name}
                {item.estimatedCurrent !== null && ` — ${fmt(item.estimatedCurrent)} left`}
              </span>
            ))}
          </div>
        </div>
      )}

      {warning.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 flex-wrap">
            <AlertTriangle size={16} className="text-amber-600 flex-shrink-0" />
            <span className="text-sm font-semibold text-amber-700">
              {warning.length} item{warning.length !== 1 ? 's' : ''} running low
            </span>
            {warning.map(item => (
              <span key={item.id} className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                {item.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Sheet sync prompt / status */}
      {!sheetData ? (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3">
          <Info size={16} className="text-blue-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-800">Sync your PCK sheet to see consumption rates</p>
            <p className="text-xs text-blue-600 mt-0.5">
              Set the sheet period in Settings, then click Sync Sheet to pull your sales data.
            </p>
          </div>
          <button
            onClick={onSyncSheet}
            disabled={loadingSheet}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 border border-blue-300 rounded-lg hover:bg-blue-100 transition-colors whitespace-nowrap"
          >
            <RefreshCw size={12} className={loadingSheet ? 'animate-spin' : ''} />
            Sync Now
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <CheckCircle size={13} className="text-green-500" />
          <span>
            Sheet synced — {Object.keys(sheetData.consumption).length} packaging codes,{' '}
            {sheetData.menuItems.length} item rows
          </span>
          {sheetSettings.weeks > 0 && (
            <span>
              /{' '}
              {sheetSettings.weeks} week{sheetSettings.weeks !== 1 ? 's' : ''} →{' '}
              weekly rates calculated
            </span>
          )}
        </div>
      )}

      {/* Empty state */}
      {itemStatuses.length === 0 && (
        <div className="text-center py-20">
          <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Package size={24} className="text-orange-500" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">No packaging items yet</h3>
          <p className="text-sm text-gray-500">Go to Setup to add your first packaging item.</p>
        </div>
      )}

      {/* Item cards */}
      {itemStatuses.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {itemStatuses.map(item => {
            const sc = STATUS_CONFIG[item.status];
            const reorderLevel = item.reorder_level || 0;
            const maxForBar = Math.max(reorderLevel * 3, item.estimatedCurrent || 0, 50);
            const barPct = item.estimatedCurrent !== null
              ? Math.min(100, Math.max(2, (item.estimatedCurrent / maxForBar) * 100))
              : 0;

            return (
              <div key={item.id} className={`bg-white rounded-xl border-2 ${sc.border} p-4 space-y-3 flex flex-col`}>
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm font-semibold text-gray-900 leading-tight truncate">
                      {item.name}
                    </span>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${sc.bg} ${sc.text}`}>
                    {sc.label}
                  </span>
                </div>

                {/* Stock count */}
                <div className="flex-1">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-gray-900">
                      {item.estimatedCurrent !== null ? fmt(item.estimatedCurrent) : '—'}
                    </span>
                    <span className="text-sm text-gray-400">{item.unit}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {item.lastStocktake
                      ? <>
                          Stocktake {fmtDate(item.lastStocktake.date)}
                          {item.inboundSince > 0 && ` + ${fmt(item.inboundSince)} in`}
                        </>
                      : 'No stocktake recorded'
                    }
                  </div>
                </div>

                {/* Progress bar */}
                {item.estimatedCurrent !== null && (
                  <div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${sc.bar}`}
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs mt-1">
                      {reorderLevel > 0
                        ? <span className="text-gray-400">Reorder at {fmt(reorderLevel)}</span>
                        : <span />
                      }
                      {item.daysRemaining !== null && (
                        <span className={
                          item.daysRemaining < 7  ? 'text-red-600 font-semibold' :
                          item.daysRemaining < 14 ? 'text-amber-600 font-medium' :
                          'text-gray-400'
                        }>
                          ~{item.daysRemaining}d left
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Consumption rate */}
                {item.weeklyRate > 0 ? (
                  <div className="text-xs text-gray-400 flex items-center gap-1 border-t border-gray-100 pt-2">
                    <TrendingDown size={11} />
                    ~{fmt(item.weeklyRate)} {item.unit}/week
                    {item.sheetCons && (
                      <span className="text-gray-300 ml-1">({fmt(item.sheetCons.total)} total)</span>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-gray-400 border-t border-gray-100 pt-2">
                    {item.sku_code
                      ? `No sheet match for "${item.sku_code}"`
                      : 'No SKU code — go to Setup'
                    }
                  </div>
                )}

                {/* Quick action buttons */}
                <div className="flex gap-1.5">
                  <button
                    onClick={() => onAddEvent('stocktake', item.id)}
                    className="flex-1 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Stocktake
                  </button>
                  <button
                    onClick={() => onAddEvent('inbound', item.id)}
                    className="flex-1 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    + Delivery
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Inventory Tab ─────────────────────────────────────────────────────────────

function InventoryTab({ inventoryEvents, packagingItems, onOpenAdd, onDeleteEvent }) {
  const itemMap = Object.fromEntries(packagingItems.map(i => [i.id, i]));
  const sorted = [...inventoryEvents].sort(
    (a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Inventory Log</h2>
          <p className="text-sm text-gray-500 mt-0.5">Record stocktakes and incoming deliveries</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onOpenAdd('stocktake')}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ClipboardList size={14} />
            Stocktake
          </button>
          <button
            onClick={() => onOpenAdd('inbound')}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors"
          >
            <Truck size={14} />
            Delivery
          </button>
        </div>
      </div>

      {sorted.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <ClipboardList size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No inventory entries yet.</p>
          <p className="text-xs mt-1">Record a stocktake to get started.</p>
        </div>
      )}

      {sorted.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Item</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Qty</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes</th>
                <th className="px-4 py-3 w-8" />
              </tr>
            </thead>
            <tbody>
              {sorted.map(event => {
                const item = itemMap[event.packaging_item_id];
                return (
                  <tr key={event.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{fmtDate(event.date)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        event.type === 'stocktake'
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-green-50 text-green-700'
                      }`}>
                        {event.type === 'stocktake'
                          ? <ClipboardList size={10} />
                          : <Truck size={10} />
                        }
                        {event.type === 'stocktake' ? 'Stocktake' : 'Delivery'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: item?.color || '#ccc' }}
                        />
                        <span className="text-gray-900">{item?.name || '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {event.type === 'inbound' ? '+' : ''}{fmt(event.quantity)}
                      <span className="text-gray-400 font-normal text-xs ml-1">{item?.unit}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {event.supplier && (
                        <span className="font-medium text-gray-700 mr-1">{event.supplier}</span>
                      )}
                      {event.notes}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => onDeleteEvent(event.id)}
                        className="p-1 text-gray-300 hover:text-red-500 transition-colors rounded"
                        title="Delete entry"
                      >
                        <Trash2 size={13} />
                      </button>
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

// ── Setup Tab ─────────────────────────────────────────────────────────────────

function SetupTab({ packagingItems, sheetData, onOpenAdd, onOpenEdit, onDeleteItem, onImportFromSheet, onReorder }) {
  const [dragIdx, setDragIdx]         = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  const sheetCodes   = sheetData ? Object.keys(sheetData.consumption) : [];
  const matchedCodes = new Set(packagingItems.map(i => i.sku_code).filter(Boolean));
  const unmatchedCodes = sheetCodes.filter(c => !matchedCodes.has(c));

  function handleDrop(targetIdx) {
    if (dragIdx === null || dragIdx === targetIdx) {
      setDragIdx(null); setDragOverIdx(null); return;
    }
    const reordered = [...packagingItems];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(dragIdx < targetIdx ? targetIdx - 1 : targetIdx, 0, moved);
    onReorder(reordered);
    setDragIdx(null); setDragOverIdx(null);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Packaging Items</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Configure packaging types and link them to your sheet's PCK codes
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unmatchedCodes.length > 0 && (
            <button
              onClick={onImportFromSheet}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
              title={`Auto-create items for: ${unmatchedCodes.join(', ')}`}
            >
              <Download size={14} />
              Import from Sheet ({unmatchedCodes.length})
            </button>
          )}
          <button
            onClick={onOpenAdd}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors"
          >
            <Plus size={14} />
            Add Item
          </button>
        </div>
      </div>

      {/* Sheet code hints */}
      {sheetCodes.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-blue-700 mb-2">
            Packaging codes in your sheet ({sheetCodes.length}):
          </p>
          <div className="flex flex-wrap gap-1.5">
            {sheetCodes.map(code => (
              <span
                key={code}
                className={`px-2 py-0.5 rounded text-xs font-mono font-medium ${
                  matchedCodes.has(code)
                    ? 'bg-green-100 text-green-700'
                    : 'bg-white border border-blue-200 text-blue-700'
                }`}
              >
                {code}
                {matchedCodes.has(code) && ' ✓'}
              </span>
            ))}
          </div>
          {unmatchedCodes.length > 0 && (
            <p className="text-xs text-blue-500 mt-2">
              {unmatchedCodes.length} unmatched — click <strong>Import from Sheet</strong> to auto-create them, then rename as needed.
            </p>
          )}
        </div>
      )}

      {packagingItems.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <Package size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm mb-4">No packaging items yet</p>
          <div className="flex items-center justify-center gap-3">
            {sheetCodes.length > 0 && (
              <button
                onClick={onImportFromSheet}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
              >
                <Download size={14} />
                Import {sheetCodes.length} items from Sheet
              </button>
            )}
            <button
              onClick={onOpenAdd}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-orange-600 border border-orange-300 rounded-lg hover:bg-orange-50 transition-colors"
            >
              <Plus size={14} />
              Add manually
            </button>
          </div>
        </div>
      )}

      {packagingItems.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {packagingItems.map((item, i) => {
            const hasMatch = item.sku_code && matchedCodes.has(item.sku_code) && sheetCodes.includes(item.sku_code);
            const sheetTotal = sheetData?.consumption?.[item.sku_code]?.total;
            const isDraggingOver = dragOverIdx === i && dragIdx !== i;
            return (
              <div
                key={item.id}
                draggable
                onDragStart={() => setDragIdx(i)}
                onDragOver={e => { e.preventDefault(); setDragOverIdx(i); }}
                onDrop={() => handleDrop(i)}
                onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors select-none ${
                  dragIdx === i ? 'opacity-40' : ''
                } ${isDraggingOver ? 'border-t-2 border-orange-400' : i > 0 ? 'border-t border-gray-100' : ''}`}
              >
                <GripVertical size={14} className="text-gray-300 cursor-grab flex-shrink-0" />
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900">{item.name}</span>
                    {item.sku_code && (
                      <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                        hasMatch ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {item.sku_code}
                        {hasMatch && sheetTotal !== undefined && ` — ${fmt(sheetTotal)} in sheet`}
                      </span>
                    )}
                    {!item.sku_code && (
                      <span className="text-xs text-amber-500">No SKU code set</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {item.unit}
                    {item.reorder_level > 0 && ` · reorder at ${fmt(item.reorder_level)}`}
                    {item.reorder_qty > 0 && ` · order ${fmt(item.reorder_qty)}`}
                    {item.notes && ` · ${item.notes}`}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onOpenEdit(item)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    onClick={() => onDeleteItem(item.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Consumption Tab ───────────────────────────────────────────────────────────

function ConsumptionTab({ packagingItems, sheetData }) {
  const { weeks = [], weeklyConsumption = {}, consumption = {} } = sheetData || {};

  const itemMap = Object.fromEntries(
    packagingItems.filter(i => i.sku_code).map(i => [i.sku_code, i])
  );

  // Order by packagingItems sort_order first, then any unrecognised SKUs at the end
  const knownSkus = packagingItems
    .filter(i => i.sku_code && consumption[i.sku_code]?.total > 0)
    .map(i => i.sku_code);
  const knownSet = new Set(knownSkus);
  const unknownSkus = Object.keys(consumption)
    .filter(sku => consumption[sku].total > 0 && !knownSet.has(sku))
    .sort();
  const skus = [...knownSkus, ...unknownSkus];

  if (!sheetData || weeks.length === 0 || skus.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400">
        <BarChart2 size={32} className="mx-auto mb-3 opacity-40" />
        <p className="text-sm">No consumption data yet.</p>
        <p className="text-xs mt-1">Sync your sheet to load weekly data.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Consumption by Week</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Packaging usage from sales data &mdash; {weeks.length} week{weeks.length !== 1 ? 's' : ''} of data
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Item
              </th>
              {weeks.map(w => (
                <th key={w} className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                  {w}
                </th>
              ))}
              <th className="px-4 py-3 text-right text-xs font-semibold text-orange-600 uppercase tracking-wide">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {skus.map((sku, i) => {
              const item = itemMap[sku];
              const weekData = weeklyConsumption[sku] || {};
              const total = consumption[sku]?.total || 0;
              const weekValues = weeks.map(w => weekData[w] || 0);
              const maxVal = Math.max(...weekValues, 1);

              return (
                <tr
                  key={sku}
                  className={`hover:bg-gray-50 transition-colors ${i < skus.length - 1 ? 'border-b border-gray-50' : ''}`}
                >
                  {/* Item name */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: item?.color || '#d1d5db' }}
                      />
                      <div>
                        <div className="font-medium text-gray-900">{item?.name || sku}</div>
                        {item?.name && (
                          <div className="text-xs font-mono text-gray-400">{sku}</div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Weekly columns */}
                  {weeks.map(w => {
                    const qty = weekData[w];
                    const isMax = qty && qty === maxVal && weeks.length > 1;
                    return (
                      <td key={w} className="px-4 py-3 text-right tabular-nums">
                        {qty ? (
                          <span className={isMax ? 'font-semibold text-orange-600' : 'text-gray-700'}>
                            {fmt(qty)}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                    );
                  })}

                  {/* Total */}
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className="font-semibold text-gray-900">{fmt(total)}</span>
                    <span className="text-xs font-normal text-gray-400 ml-1">{item?.unit || 'units'}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Avg/week footer */}
          {weeks.length > 1 && (
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50">
                <td className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Avg / week
                </td>
                {weeks.map(w => <td key={w} />)}
                <td className="px-4 py-2.5 text-right text-xs text-gray-400">
                  over {weeks.length} wks
                </td>
              </tr>
              {skus.map(sku => {
                const item = itemMap[sku];
                const avg = (consumption[sku]?.total || 0) / weeks.length;
                return (
                  <tr key={`avg-${sku}`} className="border-t border-gray-100 bg-gray-50/60">
                    <td className="px-4 py-1.5 pl-8 text-xs text-gray-400">
                      {item?.name || sku}
                    </td>
                    {weeks.map(w => <td key={w} />)}
                    <td className="px-4 py-1.5 text-right text-xs text-gray-500 tabular-nums font-medium">
                      ~{fmt(avg)}/wk
                    </td>
                  </tr>
                );
              })}
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

const BLANK_ITEM  = { name: '', sku_code: '', unit: 'units', reorder_level: '', reorder_qty: '', notes: '', color: '#6366f1' };
const BLANK_EVENT = { type: 'stocktake', date: new Date().toISOString().slice(0, 10), packaging_item_id: '', quantity: '', notes: '', supplier: '' };

export default function PackagingApp({ user }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [packagingItems, setPackagingItems] = useState([]);
  const [inventoryEvents, setInventoryEvents] = useState([]);
  const [sheetData, setSheetData] = useState(null);
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  // Sheet period settings — persisted in localStorage
  const settingsKey = `packaging_settings_${user.id}`;
  const [sheetSettings, setSheetSettings] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(settingsKey)) || { startDate: '', endDate: '', weeks: 1 };
    } catch {
      return { startDate: '', endDate: '', weeks: 1 };
    }
  });

  // Modal states
  const [showItemForm, setShowItemForm]   = useState(false);
  const [editingItem, setEditingItem]     = useState(null);
  const [itemForm, setItemForm]           = useState(BLANK_ITEM);
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventForm, setEventForm]         = useState(BLANK_EVENT);
  const [showSettings, setShowSettings]   = useState(false);
  const [settingsForm, setSettingsForm]   = useState(sheetSettings);

  // ── Data loading ────────────────────────────────────────────────────────────

  useEffect(() => { loadData(); syncSheet(true); }, [user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    setLoadingData(true);
    try {
      const [items, events] = await Promise.all([
        db.getPackagingItems(user.id),
        db.getInventoryEvents(user.id),
      ]);
      setPackagingItems(items);
      setInventoryEvents(events);
    } catch (err) {
      toast.error('Failed to load packaging data');
      console.error(err);
    }
    setLoadingData(false);
  }

  async function syncSheet(silent = false) {
    setLoadingSheet(true);
    try {
      const data = await fetchPackagingData();
      setSheetData(data);
      if (!silent) {
        toast.success(
          `Sheet synced — ${Object.keys(data.consumption).length} packaging codes, ${data.menuItems.length} item rows`
        );
      }
      return data;
    } catch (err) {
      if (!silent) toast.error('Failed to fetch sheet data');
      console.error(err);
      return null;
    } finally {
      setLoadingSheet(false);
    }
  }

  const ITEM_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#8b5cf6'];

  async function importFromSheet() {
    let data = sheetData;
    if (!data) {
      data = await syncSheet(true);
      if (!data) { toast.error('Could not read sheet'); return; }
    }
    const codes = Object.keys(data.consumption);
    const existingCodes = new Set(packagingItems.map(i => i.sku_code).filter(Boolean));
    const newCodes = codes.filter(c => !existingCodes.has(c));
    if (!newCodes.length) { toast('All sheet codes are already configured'); return; }
    try {
      await Promise.all(
        newCodes.map((code, i) =>
          db.createPackagingItem(user.id, {
            name: code,
            sku_code: code,
            unit: 'units',
            color: ITEM_COLORS[i % ITEM_COLORS.length],
            reorder_level: 0,
            reorder_qty: 0,
            sort_order: packagingItems.length + i,
          })
        )
      );
      await loadData();
      toast.success(`Imported ${newCodes.length} item${newCodes.length !== 1 ? 's' : ''} from sheet — rename them in Setup`);
    } catch (err) {
      toast.error('Failed to import items');
      console.error(err);
    }
  }

  // ── Derived: per-item status ────────────────────────────────────────────────

  const itemStatuses = useMemo(() => {
    const weeks = Math.max(1, sheetSettings.weeks || 1);

    return packagingItems.map(item => {
      const sheetCons     = sheetData?.consumption?.[item.sku_code] || null;
      const totalConsumed = sheetCons?.total || 0;
      const weeklyRate    = totalConsumed / weeks;

      // Most recent stocktake
      const stocktakes = inventoryEvents
        .filter(e => e.packaging_item_id === item.id && e.type === 'stocktake')
        .sort((a, b) => b.date.localeCompare(a.date));
      const lastStocktake = stocktakes[0] || null;

      // Inbound since last stocktake
      const inboundSince = lastStocktake
        ? inventoryEvents
            .filter(e =>
              e.packaging_item_id === item.id &&
              e.type === 'inbound' &&
              e.date >= lastStocktake.date
            )
            .reduce((s, e) => s + e.quantity, 0)
        : 0;

      // Estimated current stock
      let estimatedCurrent = null;
      let daysRemaining    = null;

      if (lastStocktake) {
        const daysSince = Math.max(0, daysBetween(lastStocktake.date));
        const consumedSince = weeklyRate > 0 ? (weeklyRate / 7) * daysSince : 0;
        estimatedCurrent = Math.max(0, Math.round(lastStocktake.quantity + inboundSince - consumedSince));
        if (weeklyRate > 0) {
          daysRemaining = Math.round(estimatedCurrent / (weeklyRate / 7));
        }
      }

      const reorderLevel = item.reorder_level || 0;
      let status = 'unknown';
      if (estimatedCurrent !== null) {
        if (estimatedCurrent <= reorderLevel) {
          status = 'critical';
        } else if (
          (reorderLevel > 0 && estimatedCurrent <= reorderLevel * 2) ||
          (daysRemaining !== null && daysRemaining < 14)
        ) {
          status = 'warning';
        } else {
          status = 'ok';
        }
      }

      return { ...item, sheetCons, weeklyRate, lastStocktake, inboundSince, estimatedCurrent, daysRemaining, status };
    });
  }, [packagingItems, inventoryEvents, sheetData, sheetSettings]);

  // ── Packaging item CRUD ─────────────────────────────────────────────────────

  function openAddItem() {
    setEditingItem(null);
    setItemForm(BLANK_ITEM);
    setShowItemForm(true);
  }

  function openEditItem(item) {
    setEditingItem(item);
    setItemForm({
      name: item.name,
      sku_code: item.sku_code || '',
      unit: item.unit || 'units',
      reorder_level: item.reorder_level ?? '',
      reorder_qty: item.reorder_qty ?? '',
      notes: item.notes || '',
      color: item.color || '#6366f1',
    });
    setShowItemForm(true);
  }

  async function saveItem() {
    if (!itemForm.name.trim()) { toast.error('Name is required'); return; }
    try {
      const payload = {
        ...itemForm,
        reorder_level: parseInt(itemForm.reorder_level) || 0,
        reorder_qty:   parseInt(itemForm.reorder_qty)   || 0,
      };
      if (editingItem) {
        await db.updatePackagingItem(editingItem.id, payload);
        toast.success('Item updated');
      } else {
        await db.createPackagingItem(user.id, payload);
        toast.success('Item added');
      }
      setShowItemForm(false);
      setEditingItem(null);
      loadData();
    } catch (err) {
      toast.error('Failed to save item');
      console.error(err);
    }
  }

  async function deleteItem(id) {
    if (!window.confirm('Delete this packaging item and all its inventory history?')) return;
    try {
      await db.deletePackagingItem(id);
      toast.success('Item deleted');
      loadData();
    } catch (err) {
      toast.error('Failed to delete item');
    }
  }

  async function reorderItems(newOrder) {
    // Optimistically update local state so the UI feels instant
    setPackagingItems(newOrder);
    try {
      await Promise.all(
        newOrder.map((item, idx) => db.updatePackagingItem(item.id, { sort_order: idx }))
      );
    } catch (err) {
      toast.error('Failed to save order');
      loadData(); // revert to server state on failure
    }
  }

  // ── Inventory event CRUD ────────────────────────────────────────────────────

  function openAddEvent(type = 'stocktake', itemId = '') {
    setEventForm({ ...BLANK_EVENT, type, packaging_item_id: itemId });
    setShowEventForm(true);
  }

  async function saveEvent() {
    if (!eventForm.packaging_item_id) { toast.error('Select a packaging item'); return; }
    if (!eventForm.quantity || parseInt(eventForm.quantity) <= 0) { toast.error('Enter a valid quantity'); return; }
    try {
      await db.addInventoryEvent(user.id, { ...eventForm, quantity: parseInt(eventForm.quantity) });
      toast.success(eventForm.type === 'stocktake' ? 'Stocktake recorded' : 'Delivery recorded');
      setShowEventForm(false);
      setEventForm(BLANK_EVENT);
      loadData();
    } catch (err) {
      toast.error('Failed to save entry');
      console.error(err);
    }
  }

  async function deleteEvent(id) {
    try {
      await db.deleteInventoryEvent(id);
      toast.success('Entry deleted');
      loadData();
    } catch (err) {
      toast.error('Failed to delete entry');
    }
  }

  // ── Sheet settings ──────────────────────────────────────────────────────────

  function applySettings() {
    const start = settingsForm.startDate ? new Date(settingsForm.startDate) : null;
    const end   = settingsForm.endDate   ? new Date(settingsForm.endDate)   : null;
    const weeks = (start && end) ? Math.max(1, Math.round((end - start) / (7 * 86400000))) : 1;
    const updated = { ...settingsForm, weeks };
    setSheetSettings(updated);
    localStorage.setItem(settingsKey, JSON.stringify(updated));
    toast.success(`Sheet period: ${weeks} week${weeks !== 1 ? 's' : ''}`);
    setShowSettings(false);
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loadingData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
      </div>
    );
  }

  const TABS = [
    { id: 'dashboard',   label: 'Dashboard',   Icon: Package },
    { id: 'consumption', label: 'Consumption',  Icon: BarChart2 },
    { id: 'inventory',   label: 'Inventory',    Icon: ClipboardList },
    { id: 'setup',       label: 'Setup',        Icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
              <Package size={17} className="text-orange-600" />
            </div>
            <h1 className="text-lg font-semibold text-gray-900">Packaging</h1>
            {sheetSettings.startDate && (
              <span className="hidden sm:inline text-xs text-gray-400 ml-1">
                Sheet: {fmtDate(sheetSettings.startDate)} – {fmtDate(sheetSettings.endDate)}
                {' '}({sheetSettings.weeks}w)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => { setSettingsForm(sheetSettings); setShowSettings(true); }}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Sheet period settings"
            >
              <Settings size={15} />
            </button>
            <button
              onClick={syncSheet}
              disabled={loadingSheet}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors disabled:opacity-60"
            >
              <RefreshCw size={13} className={loadingSheet ? 'animate-spin' : ''} />
              {loadingSheet ? 'Syncing…' : 'Sync Sheet'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                activeTab === id
                  ? 'bg-orange-100 text-orange-700'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="p-6 max-w-6xl mx-auto">
        {activeTab === 'dashboard' && (
          <DashboardTab
            itemStatuses={itemStatuses}
            sheetData={sheetData}
            sheetSettings={sheetSettings}
            onAddEvent={openAddEvent}
            onSyncSheet={syncSheet}
            loadingSheet={loadingSheet}
          />
        )}
        {activeTab === 'consumption' && (
          <ConsumptionTab
            packagingItems={packagingItems}
            sheetData={sheetData}
          />
        )}
        {activeTab === 'inventory' && (
          <InventoryTab
            inventoryEvents={inventoryEvents}
            packagingItems={packagingItems}
            onOpenAdd={openAddEvent}
            onDeleteEvent={deleteEvent}
          />
        )}
        {activeTab === 'setup' && (
          <SetupTab
            packagingItems={packagingItems}
            sheetData={sheetData}
            onOpenAdd={openAddItem}
            onOpenEdit={openEditItem}
            onDeleteItem={deleteItem}
            onImportFromSheet={importFromSheet}
            onReorder={reorderItems}
          />
        )}
      </div>

      {/* ── Sheet settings modal ── */}
      {showSettings && (
        <Modal title="Sheet Period Settings" onClose={() => setShowSettings(false)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Set the date range your PCK Data sheet covers. Used to calculate average weekly consumption rates.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-medium text-gray-700">Start Date</span>
                <input
                  type="date"
                  value={settingsForm.startDate}
                  onChange={e => setSettingsForm(s => ({ ...s, startDate: e.target.value }))}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-700">End Date</span>
                <input
                  type="date"
                  value={settingsForm.endDate}
                  onChange={e => setSettingsForm(s => ({ ...s, endDate: e.target.value }))}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </label>
            </div>
            {settingsForm.startDate && settingsForm.endDate && (
              <p className="text-sm font-medium text-orange-600">
                = {Math.max(1, Math.round((new Date(settingsForm.endDate) - new Date(settingsForm.startDate)) / (7 * 86400000)))} weeks
              </p>
            )}
            <div className="flex gap-2 pt-1">
              <button
                onClick={applySettings}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Add/edit item modal ── */}
      {showItemForm && (
        <Modal
          title={editingItem ? 'Edit Packaging Item' : 'Add Packaging Item'}
          onClose={() => { setShowItemForm(false); setEditingItem(null); }}
        >
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                value={itemForm.name}
                onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. 8oz Paper Cup"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">SKU Code</label>
                <input
                  type="text"
                  value={itemForm.sku_code}
                  onChange={e => setItemForm(f => ({ ...f, sku_code: e.target.value }))}
                  placeholder="matches PCK columns"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
                <p className="text-xs text-gray-400 mt-1">Must match PCK1–4 codes in sheet</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Unit</label>
                <input
                  type="text"
                  value={itemForm.unit}
                  onChange={e => setItemForm(f => ({ ...f, unit: e.target.value }))}
                  placeholder="units, sleeves, packs…"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Reorder Level ({itemForm.unit || 'units'})
                </label>
                <input
                  type="number"
                  value={itemForm.reorder_level}
                  onChange={e => setItemForm(f => ({ ...f, reorder_level: e.target.value }))}
                  placeholder="e.g. 500"
                  min="0"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Reorder Qty ({itemForm.unit || 'units'})
                </label>
                <input
                  type="number"
                  value={itemForm.reorder_qty}
                  onChange={e => setItemForm(f => ({ ...f, reorder_qty: e.target.value }))}
                  placeholder="e.g. 1000"
                  min="0"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">Color</label>
              <div className="flex gap-2 flex-wrap">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setItemForm(f => ({ ...f, color: c }))}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${
                      itemForm.color === c ? 'border-gray-800 scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
              <input
                type="text"
                value={itemForm.notes}
                onChange={e => setItemForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Supplier, size details…"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={saveItem}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors"
              >
                {editingItem ? 'Update' : 'Add Item'}
              </button>
              <button
                onClick={() => { setShowItemForm(false); setEditingItem(null); }}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Add inventory event modal ── */}
      {showEventForm && (
        <Modal
          title={eventForm.type === 'stocktake' ? 'Record Stocktake' : 'Record Delivery'}
          onClose={() => setShowEventForm(false)}
        >
          <div className="space-y-3">
            {/* Type picker */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">Type</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { val: 'stocktake', label: 'Stocktake', desc: 'Physical count on hand', Icon: ClipboardList },
                  { val: 'inbound',   label: 'Delivery',  desc: 'Stock received',          Icon: Truck },
                ].map(({ val, label, desc, Icon }) => (
                  <button
                    key={val}
                    onClick={() => setEventForm(f => ({ ...f, type: val }))}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      eventForm.type === val
                        ? 'border-orange-400 bg-orange-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Icon size={13} className={eventForm.type === val ? 'text-orange-600' : 'text-gray-400'} />
                      <span className="text-sm font-medium text-gray-900">{label}</span>
                    </div>
                    <div className="text-xs text-gray-500">{desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Date *</label>
                <input
                  type="date"
                  value={eventForm.date}
                  onChange={e => setEventForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Packaging Item *</label>
                <select
                  value={eventForm.packaging_item_id}
                  onChange={e => setEventForm(f => ({ ...f, packaging_item_id: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white"
                >
                  <option value="">Select…</option>
                  {packagingItems.map(item => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Quantity *
                {eventForm.packaging_item_id && (() => {
                  const item = packagingItems.find(i => i.id === eventForm.packaging_item_id);
                  return item ? ` (${item.unit})` : '';
                })()}
                {eventForm.type === 'stocktake' && ' — total on hand'}
              </label>
              <input
                type="number"
                value={eventForm.quantity}
                onChange={e => setEventForm(f => ({ ...f, quantity: e.target.value }))}
                placeholder="0"
                min="1"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
              />
            </div>

            {eventForm.type === 'inbound' && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Supplier</label>
                <input
                  type="text"
                  value={eventForm.supplier}
                  onChange={e => setEventForm(f => ({ ...f, supplier: e.target.value }))}
                  placeholder="e.g. Ordermentum, Foodbyus…"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
              <input
                type="text"
                value={eventForm.notes}
                onChange={e => setEventForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Optional…"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={saveEvent}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => setShowEventForm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
