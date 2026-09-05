import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Loader2, BarChart3 } from 'lucide-react';
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
function mondayOf(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const dow = d.getDay(); // 0 = Sun
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  return fmtISO(d);
}
function dayLabel(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'long' }).toUpperCase();
}
function dayShort(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
}
function fmtDateShort(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Small nav bar shared by Day / Week modes ─────────────────────────────────

function NavBar({ label, sublabel, onPrev, onNext, onToday, showToday }) {
  return (
    <div className="shrink-0 border-b px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2 bg-white" style={{ borderColor: 'var(--top-border)' }}>
      <div className="flex items-center gap-1.5">
        <button
          onClick={onPrev}
          className="p-2.5 rounded-lg transition-colors hover:brightness-95 active:brightness-90"
          style={{ background: 'color-mix(in srgb, var(--primary) 12%, white)', color: 'var(--primary-dk)' }}
        >
          <ChevronLeft size={20} strokeWidth={2.5} />
        </button>
        <div className="text-center min-w-[150px]">
          <div className="text-sm font-bold text-gray-900 leading-tight tracking-tight">{label}</div>
          {sublabel && <div className="text-xs text-gray-400">{sublabel}</div>}
        </div>
        <button
          onClick={onNext}
          className="p-2.5 rounded-lg transition-colors hover:brightness-95 active:brightness-90"
          style={{ background: 'color-mix(in srgb, var(--primary) 12%, white)', color: 'var(--primary-dk)' }}
        >
          <ChevronRight size={20} strokeWidth={2.5} />
        </button>
      </div>
      {showToday && (
        <button onClick={onToday} className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors">
          Today
        </button>
      )}
    </div>
  );
}

// ── Day view: category stat tiles + nested item breakdown ───────────────────

function DayInsights({ date, setDate, grouped, qtyFor, hideZero }) {
  const [collapsed, setCollapsed] = useState(() => new Set());

  const categoryTotals = grouped.map(([cat, catItems]) => ({
    cat,
    total: catItems.reduce((s, it) => s + qtyFor(date, it.id), 0),
  }));
  const grandTotal = categoryTotals.reduce((s, c) => s + c.total, 0);

  const visibleGroups = grouped
    .map(([cat, catItems]) => {
      const items = hideZero ? catItems.filter(it => qtyFor(date, it.id) > 0) : catItems;
      const total = catItems.reduce((s, it) => s + qtyFor(date, it.id), 0);
      return { cat, items, total };
    })
    .filter(g => !hideZero || g.total > 0);

  function toggle(cat) {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  }

  return (
    <>
      <NavBar
        label={dayLabel(date)}
        sublabel={fmtDateShort(date)}
        onPrev={() => setDate(d => addDays(d, -1))}
        onNext={() => setDate(d => addDays(d, 1))}
        onToday={() => setDate(todayStr())}
        showToday={date !== todayStr()}
      />

      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-3xl mx-auto space-y-5">
          {/* Category stat tiles */}
          <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))' }}>
            {categoryTotals.map(({ cat, total }) => (
              <div key={cat} className="rounded-xl px-3 py-2.5 text-center" style={{ background: total > 0 ? '#DCFCE7' : '#F9FAFB' }}>
                <p className="text-2xl font-extrabold tabular-nums" style={{ color: total > 0 ? 'var(--primary)' : '#D1D5DB' }}>{total}</p>
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide truncate">{cat}</p>
              </div>
            ))}
            <div className="rounded-xl px-3 py-2.5 text-center border-2" style={{ borderColor: 'var(--primary)' }}>
              <p className="text-2xl font-extrabold tabular-nums" style={{ color: 'var(--primary)' }}>{grandTotal}</p>
              <p className="text-[11px] font-semibold uppercase tracking-wide truncate" style={{ color: 'var(--primary)' }}>Total</p>
            </div>
          </div>

          {/* Nested category -> item breakdown */}
          {visibleGroups.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">Nothing produced this day.</p>
          ) : (
            <div className="space-y-3">
              {visibleGroups.map(({ cat, items, total }) => {
                const isCollapsed = collapsed.has(cat);
                return (
                  <div key={cat} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <button onClick={() => toggle(cat)} className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50/60 transition-colors">
                      <span className="text-sm font-bold text-gray-900">{cat}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-extrabold tabular-nums" style={{ color: 'var(--primary)' }}>{total}</span>
                        {isCollapsed ? <ChevronDown size={15} className="text-gray-300" /> : <ChevronUp size={15} className="text-gray-300" />}
                      </div>
                    </button>
                    {!isCollapsed && (
                      <div className="divide-y divide-gray-50 border-t border-gray-50">
                        {items.map(it => {
                          const qty = qtyFor(date, it.id);
                          return (
                            <div key={it.id} className="flex items-center gap-2.5 px-4 py-2" style={{ background: qty > 0 ? 'rgba(21,128,61,0.04)' : 'white' }}>
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: it.color }} />
                              <span className={`flex-1 text-sm truncate ${qty > 0 ? 'font-semibold text-gray-900' : 'font-medium text-gray-400'}`}>{it.name}</span>
                              <span className={`text-sm font-bold tabular-nums ${qty > 0 ? 'text-gray-700' : 'text-gray-300'}`}>{qty}</span>
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
      </div>
    </>
  );
}

// ── Week view: pivot table, days as columns, categories expand to items ─────

function WeekInsights({ weekStart, setWeekStart, grouped, qtyFor, hideZero }) {
  const [expanded, setExpanded] = useState(() => new Set());
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  function toggle(cat) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  }

  const catRows = grouped.map(([cat, catItems]) => {
    const perDay = days.map(d => catItems.reduce((s, it) => s + qtyFor(d, it.id), 0));
    const weekTotal = perDay.reduce((s, v) => s + v, 0);
    return { cat, items: catItems, perDay, weekTotal };
  }).filter(r => !hideZero || r.weekTotal > 0);

  const grandPerDay = days.map((_, i) => catRows.reduce((s, r) => s + r.perDay[i], 0));
  const grandTotal = grandPerDay.reduce((s, v) => s + v, 0);

  return (
    <>
      <NavBar
        label={`${isoWeekLabel(weekStart)} · Week of ${dayShort(weekStart)}`}
        sublabel={`${fmtDateShort(weekStart)} – ${fmtDateShort(addDays(weekStart, 6))}`}
        onPrev={() => setWeekStart(w => addDays(w, -7))}
        onNext={() => setWeekStart(w => addDays(w, 7))}
        onToday={() => setWeekStart(mondayOf(todayStr()))}
        showToday={weekStart !== mondayOf(todayStr())}
      />

      <div className="flex-1 overflow-auto p-3">
        {catRows.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">Nothing produced this week.</p>
        ) : (
          <table className="mx-auto text-sm border-collapse">
            <thead>
              <tr>
                <th className="sticky top-0 left-0 z-20 bg-gray-50 text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">Category</th>
                {days.map(d => (
                  <th key={d} className="sticky top-0 z-10 bg-gray-50 text-center px-2.5 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100 whitespace-nowrap">
                    {dayShort(d)}
                  </th>
                ))}
                <th className="sticky top-0 z-10 text-center px-3 py-2 text-xs font-bold uppercase tracking-wide border-b border-gray-100 whitespace-nowrap" style={{ background: '#F0FDF4', color: 'var(--primary)' }}>
                  Week
                </th>
              </tr>
            </thead>
            <tbody>
              {catRows.map(({ cat, items, perDay, weekTotal }) => {
                const isOpen = expanded.has(cat);
                return (
                  <React.Fragment key={cat}>
                    <tr onClick={() => toggle(cat)} className="cursor-pointer hover:bg-gray-50/60 transition-colors">
                      <td className="px-3 py-2 sticky left-0 bg-white border-b border-gray-50">
                        <div className="flex items-center gap-1.5">
                          {isOpen ? <ChevronUp size={13} className="text-gray-300 shrink-0" /> : <ChevronDown size={13} className="text-gray-300 shrink-0" />}
                          <span className="text-sm font-bold text-gray-900">{cat}</span>
                        </div>
                      </td>
                      {perDay.map((v, i) => (
                        <td key={i} className="px-2.5 py-2 text-center border-b border-gray-50 whitespace-nowrap">
                          <span className={`text-sm font-bold tabular-nums ${v > 0 ? 'text-gray-700' : 'text-gray-300'}`}>{v}</span>
                        </td>
                      ))}
                      <td className="px-3 py-2 text-center border-b border-gray-50 whitespace-nowrap" style={{ background: '#F0FDF4' }}>
                        <span className="text-sm font-extrabold tabular-nums" style={{ color: 'var(--primary)' }}>{weekTotal}</span>
                      </td>
                    </tr>
                    {isOpen && items.map(it => {
                      const itemPerDay = days.map(d => qtyFor(d, it.id));
                      const itemTotal = itemPerDay.reduce((s, v) => s + v, 0);
                      if (hideZero && itemTotal === 0) return null;
                      return (
                        <tr key={it.id}>
                          <td className="px-3 py-1.5 sticky left-0 bg-white border-b border-gray-50">
                            <div className="flex items-center gap-2 pl-4">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: it.color }} />
                              <span className="text-xs text-gray-600 truncate">{it.name}</span>
                            </div>
                          </td>
                          {itemPerDay.map((v, i) => (
                            <td key={i} className="px-2.5 py-1.5 text-center border-b border-gray-50 whitespace-nowrap">
                              <span className={`text-xs font-semibold tabular-nums ${v > 0 ? 'text-gray-600' : 'text-gray-300'}`}>{v}</span>
                            </td>
                          ))}
                          <td className="px-3 py-1.5 text-center border-b border-gray-50 whitespace-nowrap bg-gray-50">
                            <span className="text-xs font-bold tabular-nums text-gray-500">{itemTotal}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td className="sticky left-0 bg-white px-3 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide border-t-2 border-gray-100">Total</td>
                {grandPerDay.map((v, i) => (
                  <td key={i} className="bg-white text-center px-2.5 py-2.5 text-sm font-extrabold tabular-nums text-gray-700 border-t-2 border-gray-100 whitespace-nowrap">{v}</td>
                ))}
                <td className="text-center px-3 py-2.5 text-base font-extrabold tabular-nums border-t-2 border-gray-100 whitespace-nowrap" style={{ background: '#F0FDF4', color: 'var(--primary)' }}>
                  {grandTotal}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </>
  );
}

// ── Main Insights panel ───────────────────────────────────────────────────────

export default function ProductionInsights({ orgId, items }) {
  const [mode, setMode] = useState('day'); // 'day' | 'week'
  const [day, setDay] = useState(todayStr());
  const [weekStart, setWeekStart] = useState(mondayOf(todayStr()));
  const [hideZero, setHideZero] = useState(true);
  const [entriesByDate, setEntriesByDate] = useState({});
  const [loading, setLoading] = useState(true);

  const rangeStart = mode === 'day' ? day : weekStart;
  const rangeEnd = mode === 'day' ? day : addDays(weekStart, 6);

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const rows = await db.getProductionPlanRange(orgId, rangeStart, rangeEnd);
      const byDate = {};
      rows.forEach(r => {
        if (!byDate[r.plan_date]) byDate[r.plan_date] = new Map();
        const m = byDate[r.plan_date];
        m.set(r.item_id, (m.get(r.item_id) || 0) + (Number(r.qty) || 0));
      });
      setEntriesByDate(byDate);
    } catch (err) {
      toast.error('Failed to load insights: ' + (err.message || 'unknown error'));
    } finally {
      setLoading(false);
    }
  }, [orgId, rangeStart, rangeEnd]);

  useEffect(() => { load(); }, [load]);

  const qtyFor = useCallback((dateStr, itemId) => entriesByDate[dateStr]?.get(itemId) || 0, [entriesByDate]);

  const grouped = useMemo(() => {
    const g = new Map();
    items.forEach(it => {
      const cat = it.category || 'Other';
      if (!g.has(cat)) g.set(cat, []);
      g.get(cat).push(it);
    });
    return [...g.entries()];
  }, [items]);

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--app-bg)' }}>
      <div className="shrink-0 px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap bg-white border-b" style={{ borderColor: 'var(--top-border)' }}>
        <div className="flex items-center gap-1.5">
          <BarChart3 size={16} className="text-gray-400" />
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
            {[{ id: 'day', label: 'Day' }, { id: 'week', label: 'Week' }].map(t => (
              <button
                key={t.id}
                onClick={() => setMode(t.id)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${mode === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-1.5 text-xs text-gray-500 select-none cursor-pointer">
          <input type="checkbox" checked={hideZero} onChange={e => setHideZero(e.target.checked)} className="rounded" />
          Hide zero
        </label>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={20} className="animate-spin text-gray-400" />
        </div>
      ) : mode === 'day' ? (
        <DayInsights date={day} setDate={setDay} grouped={grouped} qtyFor={qtyFor} hideZero={hideZero} />
      ) : (
        <WeekInsights weekStart={weekStart} setWeekStart={setWeekStart} grouped={grouped} qtyFor={qtyFor} hideZero={hideZero} />
      )}
    </div>
  );
}
