import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Sparkles, Upload, Loader2, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  AlertTriangle, Check, X, Percent, Layers,
} from 'lucide-react';
import { db } from './supabaseClient';
import toast from 'react-hot-toast';
import { isoWeekLabel } from './isoWeek';

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
function dayOfWeekIndex(dateStr) { return new Date(dateStr + 'T12:00:00').getDay(); } // 0=Sun..6=Sat
const DOW_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function fmtDateLong(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtDateShort(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}
// Monday of the ISO week containing dateStr -- same Monday-start convention
// used throughout the app (roster, R-Prod insights, R-Stock).
function mondayOf(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const dow = d.getDay(); // 0 = Sun
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  return fmtISO(d);
}

// ── Quantity resolver ────────────────────────────────────────────────────────
// Same recursive-expansion shape as R-Recipe's cost resolver, but tracking
// grams-of-each-base-SKU-per-unit instead of a dollar cost -- lets a
// forecasted item quantity be expanded straight down to ingredient totals.

function useQtyResolver(components, componentLines, menuItemLines) {
  return useMemo(() => {
    const componentById = new Map(components.map(c => [c.id, c]));
    const linesByComponent = new Map();
    componentLines.forEach(l => {
      if (!linesByComponent.has(l.component_id)) linesByComponent.set(l.component_id, []);
      linesByComponent.get(l.component_id).push(l);
    });
    const linesByItem = new Map();
    menuItemLines.forEach(l => {
      if (!linesByItem.has(l.item_id)) linesByItem.set(l.item_id, []);
      linesByItem.get(l.item_id).push(l);
    });

    const compCache = new Map();
    function componentExpansion(componentId, visiting = new Set()) {
      if (compCache.has(componentId)) return compCache.get(componentId);
      if (visiting.has(componentId)) return new Map();
      const component = componentById.get(componentId);
      const yieldQty = Number(component?.batch_yield) || 0;
      if (!component || yieldQty <= 0) return new Map();
      visiting.add(componentId);
      const result = new Map();
      (linesByComponent.get(componentId) || []).forEach(line => {
        const qty = Number(line.qty) || 0;
        if (line.stock_item_id) {
          result.set(line.stock_item_id, (result.get(line.stock_item_id) || 0) + qty / yieldQty);
        } else if (line.sub_component_id) {
          componentExpansion(line.sub_component_id, visiting).forEach((g, skuId) => {
            result.set(skuId, (result.get(skuId) || 0) + (g * qty) / yieldQty);
          });
        }
      });
      visiting.delete(componentId);
      compCache.set(componentId, result);
      return result;
    }

    // Grams of each base SKU needed per single unit of this menu item sold.
    function itemExpansion(itemId) {
      const result = new Map();
      (linesByItem.get(itemId) || []).forEach(line => {
        const qty = Number(line.qty) || 0;
        if (line.stock_item_id) {
          result.set(line.stock_item_id, (result.get(line.stock_item_id) || 0) + qty);
        } else if (line.component_id) {
          componentExpansion(line.component_id).forEach((g, skuId) => {
            result.set(skuId, (result.get(skuId) || 0) + g * qty);
          });
        }
      });
      return result;
    }

    return { itemExpansion };
  }, [components, componentLines, menuItemLines]);
}

// ── Sales import ─────────────────────────────────────────────────────────────
// Paste rows copied straight out of a spreadsheet (Date / Category / Item /
// Qty Sold, tab- or comma-separated, header row optional) and match each
// Item name against the existing menu-item catalog.

function parseSalesPaste(text, itemByName) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const rows = [];
  const unmatched = new Set();
  for (const line of lines) {
    const cells = line.includes('\t') ? line.split('\t') : line.split(',');
    if (cells.length < 3) continue;
    const trimmed = cells.map(c => c.trim());
    // Accept either [Date, Day, Category, Item, Qty] or [Date, Category, Item, Qty] or [Date, Item, Qty]
    const qtyRaw = trimmed[trimmed.length - 1];
    const itemName = trimmed[trimmed.length - 2];
    const dateRaw = trimmed[0];
    if (!dateRaw || !itemName || /^item$/i.test(itemName) || /^date$/i.test(dateRaw)) continue;
    const qty = parseFloat(qtyRaw);
    if (isNaN(qty)) continue;
    const parsedDate = parseFlexibleDate(dateRaw);
    if (!parsedDate) continue;
    const item = itemByName.get(itemName.toLowerCase());
    if (!item) { unmatched.add(itemName); continue; }
    rows.push({ sale_date: parsedDate, item_id: item.id, item_name: item.name, qty });
  }
  return { rows, unmatched: [...unmatched] };
}

function parseFlexibleDate(raw) {
  // Handles D/M/YYYY (as in the source spreadsheet) and YYYY-MM-DD
  const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null;
}

function ImportSalesModal({ orgId, items, onClose, onSaved }) {
  const [text, setText] = useState('');
  const [preview, setPreview] = useState(null);
  const [importing, setImporting] = useState(false);

  const itemByName = useMemo(() => new Map(items.map(i => [i.name.toLowerCase(), i])), [items]);

  function handlePreview() {
    const { rows, unmatched } = parseSalesPaste(text, itemByName);
    setPreview({ rows, unmatched });
  }

  async function handleImport() {
    if (!preview || preview.rows.length === 0) return;
    setImporting(true);
    try {
      const payload = preview.rows.map(r => ({ sale_date: r.sale_date, item_id: r.item_id, qty: r.qty }));
      await db.bulkUpsertSalesHistory(orgId, payload);
      toast.success(`Imported ${payload.length} rows`);
      onSaved();
      onClose();
    } catch (err) {
      toast.error('Failed to import: ' + (err.message || 'unknown error'));
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">Import Sales History</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3 overflow-y-auto">
          <p className="text-xs text-gray-500">
            Paste rows copied from a spreadsheet: Date, Category, Item, Qty Sold (tab or comma separated).
            Item names must match your existing menu items exactly.
          </p>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={'24/11/2025\tToasties\tB&E Toastie\t5\n24/11/2025\tSalads\tChicken Caesar\t10'}
            rows={8}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2"
            style={{ '--tw-ring-color': 'var(--primary)' }}
          />
          <button onClick={handlePreview} disabled={!text.trim()} className="btn-secondary text-sm disabled:opacity-40">
            Preview
          </button>

          {preview && (
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <p className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                <Check size={14} className="text-green-600" /> {preview.rows.length} row{preview.rows.length !== 1 ? 's' : ''} ready to import
              </p>
              {preview.unmatched.length > 0 && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 flex items-start gap-1.5">
                  <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
                  <span>{preview.unmatched.length} item name{preview.unmatched.length !== 1 ? 's' : ''} didn't match your catalog and were skipped: {preview.unmatched.join(', ')}</span>
                </p>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-2 px-5 py-4 border-t border-gray-100">
          <button
            onClick={handleImport}
            disabled={!preview || preview.rows.length === 0 || importing}
            className="btn-primary flex-1 disabled:opacity-50"
          >
            {importing ? 'Importing…' : `Import ${preview?.rows.length ?? 0} rows`}
          </button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Sales History tab ────────────────────────────────────────────────────────

function SalesHistoryTab({ orgId, items, salesHistory, onRefresh }) {
  const [showImport, setShowImport] = useState(false);

  const dateRange = useMemo(() => {
    if (salesHistory.length === 0) return null;
    const dates = salesHistory.map(r => r.sale_date).sort();
    return { from: dates[0], to: dates[dates.length - 1] };
  }, [salesHistory]);

  const itemCount = useMemo(() => new Set(salesHistory.map(r => r.item_id)).size, [salesHistory]);

  return (
    <div className="space-y-4">
      <div className="card p-5 flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">{salesHistory.length} rows imported</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {dateRange ? `${dateRange.from} to ${dateRange.to} · ${itemCount} items` : 'No sales history yet -- import a POS export to power the forecast.'}
          </p>
        </div>
        <button onClick={() => setShowImport(true)} className="btn-primary flex items-center gap-1.5 text-sm">
          <Upload size={14} /> Import Sales
        </button>
      </div>

      {showImport && (
        <ImportSalesModal orgId={orgId} items={items} onClose={() => setShowImport(false)} onSaved={onRefresh} />
      )}
    </div>
  );
}

// ── Forecast tab ──────────────────────────────────────────────────────────────
// Each sales channel is forecast independently (its own day-of-week average),
// then the channels are ADDED together -- in-store customers, delivery-app
// customers, and Classpass customers are different people ordering on top of
// each other, not samples of the same demand to be blended into one average.

const CHANNEL_GROUPS = [
  { key: 'instore', label: 'In-Store', channels: ['pos'] },
  { key: 'delivery', label: 'Delivery Apps', channels: ['ubereats', 'doordash'] },
  { key: 'classpass', label: 'Classpass', channels: ['classpass'] },
];
const CHANNEL_TO_GROUP = new Map(
  CHANNEL_GROUPS.flatMap(g => g.channels.map(ch => [ch, g.key]))
);

// Same math the single-day Forecast tab uses, factored out so the weekly
// rollup can call it once per date and sum -- forecasts stay identical
// whichever tab you look at them from.
function forecastItemsForDate(items, dowAverages, uplift, dateStr) {
  const dow = dayOfWeekIndex(dateStr);
  return items.map(item => {
    const groupStats = CHANNEL_GROUPS.map(g => {
      const bucket = dowAverages.get(`${item.id}:${dow}:${g.key}`);
      const avg = bucket ? bucket[0] / bucket[1] : 0;
      const samples = bucket ? bucket[1] : 0;
      return { ...g, avg, samples };
    });
    const baseTotal = groupStats.reduce((s, g) => s + g.avg, 0);
    const forecast = baseTotal * uplift;
    const samples = groupStats.reduce((s, g) => s + g.samples, 0);
    return { item, groupStats, forecast, samples };
  }).filter(f => f.forecast > 0 || f.samples > 0);
}

// kg/L display conversion for the weekly SKU rollup -- same >=1000 rule
// used in R-Stock, kept local here since it's the only place in Crystal
// Ball that shows raw stock-item quantities to a human.
function trimNum(n) {
  const num = Number(n);
  if (!isFinite(num)) return '0';
  return (Math.round(num * 100) / 100).toString();
}
function formatQtyHuman(qty, uom) {
  if ((uom === 'g' || uom === 'ml') && qty >= 1000) {
    return `${trimNum(qty / 1000)} ${uom === 'g' ? 'kg' : 'L'}`;
  }
  return `${trimNum(qty)} ${uom || ''}`;
}
function packEquivalent(qty, sku) {
  if (!sku.order_pack_label || !(Number(sku.pack_size) > 0)) return null;
  const count = qty / Number(sku.pack_size);
  return `≈ ${trimNum(count)} ${sku.order_pack_label}${Math.abs(count - 1) < 0.001 ? '' : 's'}`;
}

function ForecastTab({ orgId, items, dowAverages, resolver, skuById, settings, onSettingsSaved }) {
  const [date, setDate] = useState(addDays(todayStr(), 1));
  const [upliftInput, setUpliftInput] = useState(String(settings?.channel_uplift_pct ?? 0));
  const [savingUplift, setSavingUplift] = useState(false);
  const [collapsedForecast, setCollapsedForecast] = useState(() => new Set());
  const [collapsedPrep, setCollapsedPrep] = useState(() => new Set());

  function toggleForecastCat(cat) {
    setCollapsedForecast(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  }
  function togglePrepCat(cat) {
    setCollapsedPrep(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  }

  useEffect(() => { setUpliftInput(String(settings?.channel_uplift_pct ?? 0)); }, [settings]);

  async function saveUplift() {
    const pct = parseFloat(upliftInput);
    if (isNaN(pct)) return;
    setSavingUplift(true);
    try {
      await db.upsertCrystalBallSettings(orgId, { channel_uplift_pct: pct });
      onSettingsSaved();
    } catch (err) {
      toast.error('Failed to save: ' + (err.message || 'unknown error'));
    } finally {
      setSavingUplift(false);
    }
  }

  const uplift = 1 + (Number(settings?.channel_uplift_pct) || 0) / 100;

  const itemForecasts = useMemo(
    () => forecastItemsForDate(items, dowAverages, uplift, date),
    [items, dowAverages, date, uplift]
  );

  const ingredientTotals = useMemo(() => {
    const totals = new Map();
    itemForecasts.forEach(({ item, forecast }) => {
      if (forecast <= 0) return;
      resolver.itemExpansion(item.id).forEach((gramsPerUnit, skuId) => {
        totals.set(skuId, (totals.get(skuId) || 0) + gramsPerUnit * forecast);
      });
    });
    return [...totals.entries()]
      .map(([skuId, grams]) => ({ sku: skuById.get(skuId), grams }))
      .filter(r => r.sku)
      .sort((a, b) => a.sku.name.localeCompare(b.sku.name));
  }, [itemForecasts, resolver, skuById]);

  // Item forecast, sectioned by menu category with a per-category total --
  // categories/items keep first-seen order (not alphabetised).
  const itemForecastsByCategory = useMemo(() => {
    const groups = new Map();
    itemForecasts.forEach(f => {
      const cat = f.item.category || 'Other';
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat).push(f);
    });
    return [...groups.entries()].map(([cat, rows]) => ({
      cat,
      rows,
      groupTotals: CHANNEL_GROUPS.map((g, i) => rows.reduce((s, r) => s + r.groupStats[i].avg, 0)),
      total: rows.reduce((s, r) => s + r.forecast, 0),
    }));
  }, [itemForecasts]);

  // Ingredient prep list, sectioned by SKU category -- no combined total per
  // section since ingredients within a category can have different UoMs.
  const ingredientsByCategory = useMemo(() => {
    const groups = new Map();
    ingredientTotals.forEach(r => {
      const cat = r.sku.category || 'Other';
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat).push(r);
    });
    return [...groups.entries()];
  }, [ingredientTotals]);

  const grandForecastTotal = itemForecastsByCategory.reduce((s, g) => s + g.total, 0);
  const totalIngredientLines = ingredientTotals.length;

  const hasHistory = dowAverages.size > 0;

  return (
    <div className="space-y-5">
      <div className="card px-4 py-3 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1.5">
          <button onClick={() => setDate(d => addDays(d, -1))} className="p-2.5 rounded-lg transition-colors hover:brightness-95" style={{ background: 'color-mix(in srgb, var(--primary) 12%, white)', color: 'var(--primary-dk)' }}>
            <ChevronLeft size={18} strokeWidth={2.5} />
          </button>
          <div className="text-center min-w-[190px]">
            <div className="text-sm font-bold text-gray-900">{fmtDateLong(date)}</div>
            <div className="text-xs text-gray-400">Forecasting from {DOW_LABELS[dayOfWeekIndex(date)]} history</div>
          </div>
          <button onClick={() => setDate(d => addDays(d, 1))} className="p-2.5 rounded-lg transition-colors hover:brightness-95" style={{ background: 'color-mix(in srgb, var(--primary) 12%, white)', color: 'var(--primary-dk)' }}>
            <ChevronRight size={18} strokeWidth={2.5} />
          </button>
        </div>
        <div
          className="flex items-center gap-2 rounded-xl pl-3 pr-2 py-1.5"
          style={{ background: 'color-mix(in srgb, var(--primary) 6%, white)' }}
          title="Extra buffer on top of the modeled total -- for channels without their own history yet (e.g. B2B) or a growth trend"
        >
          <Percent size={13} style={{ color: 'var(--primary)' }} />
          <span className="text-xs font-semibold text-gray-600">Buffer</span>
          <input
            type="number" step="any" value={upliftInput}
            onChange={e => setUpliftInput(e.target.value)}
            onBlur={saveUplift}
            onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
            className="w-14 text-right bg-white border border-gray-200 rounded-lg px-1.5 py-1 text-sm font-semibold focus:outline-none focus:ring-2"
            style={{ '--tw-ring-color': 'var(--primary)' }}
          />
          <span className="text-xs text-gray-400 w-4">{savingUplift ? <Loader2 size={12} className="animate-spin" /> : '%'}</span>
        </div>
      </div>

      {!hasHistory ? (
        <div className="card p-10 text-center">
          <Sparkles size={28} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm font-medium text-gray-600">No sales history yet</p>
          <p className="text-xs text-gray-400 mt-1">Import a POS export in the Sales History tab to power this forecast.</p>
        </div>
      ) : (
        <>
          <div className="space-y-2.5">
            <div className="flex items-end justify-between px-0.5">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Item Forecast</h3>
                <p className="text-xs text-gray-400">Each channel's avg. of past {DOW_LABELS[dayOfWeekIndex(date)]}s, added together × buffer</p>
              </div>
              {itemForecastsByCategory.length > 0 && (
                <div className="text-right">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Today's Total</p>
                  <p className="text-xl font-extrabold tabular-nums" style={{ color: 'var(--primary)' }}>{Math.ceil(grandForecastTotal)}</p>
                </div>
              )}
            </div>

            {itemForecastsByCategory.length === 0 ? (
              <div className="card p-8 text-center text-sm text-gray-400">No {DOW_LABELS[dayOfWeekIndex(date)]} history yet for any item.</div>
            ) : (
              <div className="space-y-2">
                {itemForecastsByCategory.map(({ cat, rows, groupTotals, total }) => {
                  const isCollapsed = collapsedForecast.has(cat);
                  const totalBg = 'color-mix(in srgb, var(--primary) 6%, white)';
                  return (
                    <div key={cat} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                      <table className="w-full text-sm table-fixed">
                        <colgroup>
                          <col />
                          <col className="w-[15%]" />
                          <col className="w-[15%]" />
                          <col className="w-[15%]" />
                          <col className="w-[15%]" />
                        </colgroup>
                        <thead>
                          <tr
                            onClick={() => toggleForecastCat(cat)}
                            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleForecastCat(cat); } }}
                            role="button" tabIndex={0} aria-expanded={!isCollapsed}
                            className="cursor-pointer hover:brightness-[0.98] transition-[filter] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset"
                            style={{ background: 'color-mix(in srgb, var(--primary) 5%, white)', '--tw-ring-color': 'var(--primary)' }}
                          >
                            <th className="text-left px-4 py-2.5 font-bold text-gray-900 flex items-center gap-1.5">
                              {isCollapsed ? <ChevronDown size={14} className="text-gray-400 shrink-0" /> : <ChevronUp size={14} className="text-gray-400 shrink-0" />}
                              <span className="truncate">{cat}</span>
                            </th>
                            {groupTotals.map((gt, i) => (
                              <th key={CHANNEL_GROUPS[i].key} className="text-right px-3 py-2.5 font-semibold text-gray-500 tabular-nums">{gt.toFixed(1)}</th>
                            ))}
                            <th className="text-right px-4 py-2.5 font-extrabold tabular-nums" style={{ color: 'var(--primary-dk)', background: totalBg }}>{Math.ceil(total)}</th>
                          </tr>
                          {!isCollapsed && (
                            <tr className="bg-gray-50/60 border-b border-gray-100">
                              <th className="text-left px-4 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Item</th>
                              {CHANNEL_GROUPS.map(g => (
                                <th key={g.key} className="text-right px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{g.label}</th>
                              ))}
                              <th className="text-right px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--primary)', background: totalBg }}>Total</th>
                            </tr>
                          )}
                        </thead>
                        {!isCollapsed && (
                          <tbody className="divide-y divide-gray-50">
                            {rows.map(({ item, groupStats, forecast }, idx) => (
                              <tr key={item.id} className={idx % 2 === 1 ? 'bg-gray-50/40' : undefined}>
                                <td className="px-4 py-2 font-medium text-gray-800 truncate">{item.name}</td>
                                {groupStats.map(g => (
                                  <td key={g.key} className="px-3 py-2 text-right text-gray-500 tabular-nums" title={`${g.samples} sample${g.samples !== 1 ? 's' : ''}`}>
                                    {g.avg > 0 ? g.avg.toFixed(1) : '–'}
                                  </td>
                                ))}
                                <td className="px-4 py-2 text-right font-extrabold tabular-nums" style={{ color: 'var(--primary-dk)', background: totalBg }}>{Math.ceil(forecast)}</td>
                              </tr>
                            ))}
                          </tbody>
                        )}
                      </table>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-2.5">
            <div className="flex items-end justify-between px-0.5">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Ingredient Prep List</h3>
                <p className="text-xs text-gray-400">Expanded through R-Recipe from the forecast above</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-400">
                <Layers size={13} /> {totalIngredientLines} ingredient{totalIngredientLines !== 1 ? 's' : ''}
              </div>
            </div>

            {ingredientsByCategory.length === 0 ? (
              <div className="card p-8 text-center text-sm text-gray-400">Nothing to prep -- no recipes resolve for this day's forecasted items yet.</div>
            ) : (
              <div className="space-y-2">
                {ingredientsByCategory.map(([cat, rows]) => {
                  const isCollapsed = collapsedPrep.has(cat);
                  return (
                    <div key={cat} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                      <button
                        onClick={() => togglePrepCat(cat)}
                        aria-expanded={!isCollapsed}
                        className="w-full flex items-center justify-between px-4 py-2.5 hover:brightness-[0.98] transition-[filter]"
                        style={{ background: 'color-mix(in srgb, var(--primary) 5%, white)' }}
                      >
                        <span className="flex items-center gap-1.5 text-sm font-bold text-gray-900">
                          {isCollapsed ? <ChevronDown size={14} className="text-gray-400 shrink-0" /> : <ChevronUp size={14} className="text-gray-400 shrink-0" />}
                          {cat}
                        </span>
                        <span className="text-xs font-semibold text-gray-400">{rows.length} item{rows.length !== 1 ? 's' : ''}</span>
                      </button>
                      {!isCollapsed && (
                        <div className="divide-y divide-gray-50 border-t border-gray-100">
                          {rows.map(({ sku, grams }, idx) => (
                            <div key={sku.id} className={`flex items-center justify-between gap-3 px-4 py-2.5 ${idx % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
                              <p className="text-sm font-medium text-gray-800">{sku.name}</p>
                              <p className="text-sm font-semibold text-gray-700 tabular-nums">{grams.toFixed(0)} {sku.uom}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Weekly Consumption tab ──────────────────────────────────────────────────
// Same forecast + R-Recipe expansion as the daily prep list, summed across
// 7 days instead of one -- a "how much of each SKU will we get through this
// week" view to weigh against standing order sizes.

function WeeklyConsumptionTab({ items, dowAverages, uplift, resolver, skuById }) {
  // Defaults to the upcoming full ISO week (Mon-Sun), not whatever's left of
  // the current one -- this is an ordering-decision view, and "3 days left
  // in W36" is a lot less useful than a full W37. Prev/Next always shifts by
  // a full week, so it stays Monday-aligned no matter how far you navigate.
  const [startDate, setStartDate] = useState(() => addDays(mondayOf(todayStr()), 7));
  const [collapsed, setCollapsed] = useState(() => new Set());

  function toggleCat(cat) {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  }

  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(startDate, i)),
    [startDate]
  );

  const weeklyItemTotals = useMemo(() => {
    const totals = new Map(); // itemId -> forecast qty summed across the week
    weekDates.forEach(d => {
      forecastItemsForDate(items, dowAverages, uplift, d).forEach(({ item, forecast }) => {
        if (forecast <= 0) return;
        totals.set(item.id, (totals.get(item.id) || 0) + forecast);
      });
    });
    return totals;
  }, [items, dowAverages, uplift, weekDates]);

  const skuTotals = useMemo(() => {
    const totals = new Map(); // skuId -> base-uom qty for the week
    weeklyItemTotals.forEach((qty, itemId) => {
      resolver.itemExpansion(itemId).forEach((perUnit, skuId) => {
        totals.set(skuId, (totals.get(skuId) || 0) + perUnit * qty);
      });
    });
    return [...totals.entries()]
      .map(([skuId, qty]) => ({ sku: skuById.get(skuId), qty }))
      .filter(r => r.sku)
      .sort((a, b) => a.sku.name.localeCompare(b.sku.name));
  }, [weeklyItemTotals, resolver, skuById]);

  const skusByCategory = useMemo(() => {
    const groups = new Map();
    skuTotals.forEach(r => {
      const cat = r.sku.category || 'Other';
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat).push(r);
    });
    return [...groups.entries()];
  }, [skuTotals]);

  return (
    <div className="space-y-5">
      <div className="card px-4 py-3 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1.5">
          <button onClick={() => setStartDate(d => addDays(d, -7))} className="p-2.5 rounded-lg transition-colors hover:brightness-95" style={{ background: 'color-mix(in srgb, var(--primary) 12%, white)', color: 'var(--primary-dk)' }}>
            <ChevronLeft size={18} strokeWidth={2.5} />
          </button>
          <div className="text-center min-w-[220px]">
            <div className="text-sm font-bold text-gray-900">{isoWeekLabel(startDate)} · {fmtDateShort(startDate)} – {fmtDateShort(weekDates[6])}</div>
            <div className="text-xs text-gray-400">Mon–Sun, each day from its own day-of-week history</div>
          </div>
          <button onClick={() => setStartDate(d => addDays(d, 7))} className="p-2.5 rounded-lg transition-colors hover:brightness-95" style={{ background: 'color-mix(in srgb, var(--primary) 12%, white)', color: 'var(--primary-dk)' }}>
            <ChevronRight size={18} strokeWidth={2.5} />
          </button>
        </div>
        <button onClick={() => setStartDate(mondayOf(todayStr()))} className="btn-secondary text-xs">This week</button>
      </div>

      <div className="flex items-end justify-between px-0.5">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Expected Consumption</h3>
          <p className="text-xs text-gray-400">Forecast for the 7 days above, expanded through R-Recipe and summed per SKU</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-400">
          <Layers size={13} /> {skuTotals.length} SKU{skuTotals.length !== 1 ? 's' : ''}
        </div>
      </div>

      {skusByCategory.length === 0 ? (
        <div className="card p-8 text-center text-sm text-gray-400">Nothing to show -- no recipes resolve for this week's forecasted items yet.</div>
      ) : (
        <div className="space-y-2">
          {skusByCategory.map(([cat, rows]) => {
            const isCollapsed = collapsed.has(cat);
            return (
              <div key={cat} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <button
                  onClick={() => toggleCat(cat)}
                  aria-expanded={!isCollapsed}
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:brightness-[0.98] transition-[filter]"
                  style={{ background: 'color-mix(in srgb, var(--primary) 5%, white)' }}
                >
                  <span className="flex items-center gap-1.5 text-sm font-bold text-gray-900">
                    {isCollapsed ? <ChevronDown size={14} className="text-gray-400 shrink-0" /> : <ChevronUp size={14} className="text-gray-400 shrink-0" />}
                    {cat}
                  </span>
                  <span className="text-xs font-semibold text-gray-400">{rows.length} item{rows.length !== 1 ? 's' : ''}</span>
                </button>
                {!isCollapsed && (
                  <div className="divide-y divide-gray-50 border-t border-gray-100">
                    {rows.map(({ sku, qty }, idx) => {
                      const pack = packEquivalent(qty, sku);
                      return (
                        <div key={sku.id} className={`flex items-center justify-between gap-3 px-4 py-2.5 ${idx % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
                          <p className="text-sm font-medium text-gray-800">{sku.name}</p>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-gray-700 tabular-nums">{formatQtyHuman(qty, sku.uom)}</p>
                            {pack && <p className="text-[11px] text-gray-400 tabular-nums">{pack}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Top level ─────────────────────────────────────────────────────────────────

export default function CrystalBallApp({ org }) {
  const orgId = org?.id;
  const [activeTab, setActiveTab] = useState('forecast');
  const [items, setItems] = useState([]);
  const [skus, setSkus] = useState([]);
  const [components, setComponents] = useState([]);
  const [componentLines, setComponentLines] = useState([]);
  const [menuItemLines, setMenuItemLines] = useState([]);
  const [salesHistory, setSalesHistory] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!orgId) return;
    try {
      const [prodItems, stockItems, comps, compLines, itemLines, history, cbSettings] = await Promise.all([
        db.getProductionItems(orgId),
        db.getStockItems(orgId),
        db.getRecipeComponents(orgId),
        db.getRecipeComponentLines(orgId),
        db.getRecipeMenuItemLines(orgId),
        db.getSalesHistory(orgId),
        db.getCrystalBallSettings(orgId),
      ]);
      setItems(prodItems.filter(i => i.active !== false));
      setSkus(stockItems);
      setComponents(comps);
      setComponentLines(compLines);
      setMenuItemLines(itemLines);
      setSalesHistory(history);
      setSettings(cbSettings);
    } catch (err) {
      toast.error('Failed to load Crystal Ball data: ' + (err.message || 'unknown error'));
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const resolver = useQtyResolver(components, componentLines, menuItemLines);
  const skuById = useMemo(() => new Map(skus.map(s => [s.id, s])), [skus]);

  // Historical day-of-week average qty, per item, PER CHANNEL GROUP -- keeping
  // groups separate (rather than one bucket per item) is what lets them be
  // added together instead of diluting each other into one blended avg.
  // Shared by the daily Forecast tab and the Weekly Consumption rollup.
  const dowAverages = useMemo(() => {
    const buckets = new Map(); // `${itemId}:${dow}:${groupKey}` -> [sum,count]
    salesHistory.forEach(row => {
      const groupKey = CHANNEL_TO_GROUP.get(row.channel) || 'instore';
      const dow = dayOfWeekIndex(row.sale_date);
      const key = `${row.item_id}:${dow}:${groupKey}`;
      const entry = buckets.get(key) || [0, 0];
      entry[0] += Number(row.qty) || 0;
      entry[1] += 1;
      buckets.set(key, entry);
    });
    return buckets;
  }, [salesHistory]);
  const uplift = 1 + (Number(settings?.channel_uplift_pct) || 0) / 100;

  const TABS = [
    { id: 'forecast', label: 'Forecast' },
    { id: 'weekly', label: 'Week Ahead' },
    { id: 'history', label: 'Sales History' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={20} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Sparkles size={20} style={{ color: 'var(--primary)' }} /> Crystal Ball
        </h2>
        <p className="text-sm text-gray-400 mt-0.5">Demand forecasting -- historical day-of-week averages, expanded through R-Recipe into a daily ingredient prep list.</p>
      </div>

      <div className="flex gap-1 border-b border-gray-100">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px"
            style={activeTab === tab.id ? { borderColor: 'var(--primary)', color: 'var(--primary)' } : { borderColor: 'transparent', color: '#6b7280' }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'forecast' && (
        <ForecastTab orgId={orgId} items={items} dowAverages={dowAverages} resolver={resolver} skuById={skuById} settings={settings} onSettingsSaved={load} />
      )}
      {activeTab === 'weekly' && (
        <WeeklyConsumptionTab items={items} dowAverages={dowAverages} uplift={uplift} resolver={resolver} skuById={skuById} />
      )}
      {activeTab === 'history' && (
        <SalesHistoryTab orgId={orgId} items={items} salesHistory={salesHistory} onRefresh={load} />
      )}
    </div>
  );
}
