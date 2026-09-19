import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { TrendingUp, Loader2, ChevronDown, ChevronUp, ArrowUpRight, ArrowDownRight, Table2, LayoutGrid, CalendarDays } from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, ComposedChart, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import toast from 'react-hot-toast';
import {
  fetchTopline, fetchItemMovers, valueAt, wowDeltaAt, chartRowsForWindow, findMetric, weekAxis,
  fmtWeekLabel, fmtWeekRange, fmtMoney, fmtNumber, fmtPct, formatMetricValue, isoWeekParts,
} from './toplineData';

// Validated categorical palette, all 6 slots muted rather than at full UI-
// chrome or reference saturation -- a saturated hue works fine on a small
// button but reads as neon once it fills bars/lines across a whole chart.
// Orange leans toward R-Shift's own brand hue but at a calmer step
// (#eb6834 vs the brand's #E85018); violet and green are softened the
// same way (#7d6bc4 / #4c9a4f vs the deep-saturated #4a3aa7 / neon-pure
// #008300). Aqua/magenta were already the calm dataviz-reference steps.
// Blue leads (rather than orange) and orange is pushed to the *last*
// slot: this org's UI chrome (sidebar, buttons, active tab) is already
// orange everywhere via var(--primary), so a chart that also opens on
// orange doubles up and reads hottest of all; leading with the cooler,
// more neutral blue instead gives the eye relief from the rest of the
// page. Re-validated as its own theme in this order: worst adjacent CVD
// Delta E 9.2 (was a 6-8 floor-band WARN under the old orange-first
// order), worst adjacent normal-vision Delta E 25.8 -- every light-mode
// gate now clears clean, not just floor-legal. Used for anything with
// 2+ series. Single-series charts use the module's own accent
// (var(--primary), this org's brand orange) instead, so a lone trend
// line still reads as "this module's colour", not just "series 1".
const CATEGORICAL = ['#2a78d6', '#e87ba4', '#4c9a4f', '#7d6bc4', '#1baf7a', '#eb6834'];
const AXIS_COLOR = '#8a8578';
const GRID_COLOR = '#e8e4d8';
const CHART_HEIGHT = 320;
const GOOD = '#0f9d4e';
const BAD = '#d0393b';

const PERIODS = [4, 8, 12, 26, 52];

// ── Small shared pieces ──────────────────────────────────────────────────────

function DeltaPill({ delta }) {
  if (delta == null) return null;
  const good = delta >= 0;
  return (
    <span
      className="inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-full mt-1"
      style={{ color: good ? GOOD : BAD, background: good ? 'rgba(15,157,78,0.1)' : 'rgba(208,57,59,0.1)' }}
    >
      {good ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />} {fmtPct(Math.abs(delta))}
    </span>
  );
}

function StatTile({ label, value, delta }) {
  return (
    <div className="metric-card min-w-0">
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide truncate">{label}</p>
      <p className="text-lg font-bold text-gray-900 mt-1 tabular-nums truncate">{value}</p>
      <DeltaPill delta={delta} />
    </div>
  );
}

// `dates` is the same shared weekAxis(asOfDate, period) window every other
// chart on the page draws from -- previously this took a raw point-count
// capped at 20 regardless of the page's period selector, so a row's
// sparkline silently ignored the 4/8/12/26/52-week control everyone else
// respects. A bare Tooltip (no visible axis -- there's no room for one at
// 90x28) still gives the exact week/value on hover.
function Sparkline({ series, color, dates, kind }) {
  const rows = dates.filter(d => series[d] != null).map(d => ({ date: d, value: series[d] }));
  if (rows.length < 2) return <div style={{ width: 90, height: 28 }} />;
  return (
    <div style={{ width: 90, height: 28 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows}>
          <Tooltip
            labelFormatter={fmtWeekLabel}
            formatter={v => formatMetricValue(v, kind)}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${GRID_COLOR}` }}
          />
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function MetricRow({ m, idx, asOfDate, dates }) {
  const value = valueAt(m.series, asOfDate);
  const delta = wowDeltaAt(m.series, asOfDate);
  return (
    <div className={`flex items-center justify-between gap-3 px-4 py-2 ${idx % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
      <p className="text-sm font-medium text-gray-800 truncate flex-1 min-w-0">{m.metric}</p>
      <Sparkline series={m.series} color="var(--primary)" dates={dates} kind={m.kind} />
      <div className="text-right w-24 shrink-0">
        <p className="text-sm font-semibold text-gray-700 tabular-nums">{formatMetricValue(value, m.kind)}</p>
        {delta != null && (
          <p className="text-[11px] font-semibold tabular-nums" style={{ color: delta >= 0 ? GOOD : BAD }}>{delta >= 0 ? '+' : ''}{fmtPct(delta)}</p>
        )}
      </div>
    </div>
  );
}

// `sticky` is for the table view, where this header sits in a cell that
// spans every date column -- without it, scrolling that wide row (e.g. to
// the latest-week default position) carries the label off the left edge
// with nothing left onscreen but blank space, since a full-width flex box
// scrolls like anything else. Pinning it to a fixed, left-anchored width
// keeps the label readable at any scroll position, same as the metric
// column itself.
function SectionHeader({ label, count, isCollapsed, onClick, sticky }) {
  return (
    <button
      onClick={onClick}
      aria-expanded={!isCollapsed}
      className={`flex items-center justify-between gap-4 px-4 py-2.5 bg-white hover:bg-gray-50 transition-colors border-l-4 ${sticky ? 'sticky left-0 z-10 min-w-[220px] w-fit' : 'w-full'}`}
      style={{ borderColor: 'var(--primary)' }}
    >
      <span className="flex items-center gap-1.5 text-sm font-bold text-gray-900 whitespace-nowrap">
        {isCollapsed ? <ChevronDown size={14} className="text-gray-400 shrink-0" /> : <ChevronUp size={14} className="text-gray-400 shrink-0" />}
        {label}
      </span>
      <span className="text-xs font-semibold text-gray-400 whitespace-nowrap">{count} metric{count !== 1 ? 's' : ''}</span>
    </button>
  );
}

// A section small enough to read as a proper trend grid (name + value +
// mini chart per metric, same treatment as the Day-of-Week share cards)
// gets one; a bigger section (hourly buckets, subcat breakdowns, ...) stays
// the compact row list -- a card per metric would otherwise turn a
// 12-metric section into a wall of tiles instead of a scannable list.
const CARD_GRID_MAX_METRICS = 8;

function MetricGroupList({ groups, defaultOpenCount = 2, asOfDate, period }) {
  const dates = useMemo(() => weekAxis(asOfDate, period), [asOfDate, period]);
  const [collapsed, setCollapsed] = useState(() => new Set(groups.slice(defaultOpenCount).map(g => g.section)));
  function toggle(section) {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section); else next.add(section);
      return next;
    });
  }
  if (!groups.length) return <div className="card p-8 text-center text-sm text-gray-400">Nothing to show yet.</div>;
  return (
    <div className="space-y-2">
      {groups.map(({ section, metrics }) => {
        const label = section || 'Summary';
        const isCollapsed = collapsed.has(section);
        const asGrid = metrics.length <= CARD_GRID_MAX_METRICS;
        return (
          <div key={section || '_summary'} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <SectionHeader label={label} count={metrics.length} isCollapsed={isCollapsed} onClick={() => toggle(section)} />
            {!isCollapsed && (
              asGrid ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 border-t border-gray-100">
                  {metrics.map(m => (
                    <MetricMiniCard key={m.metric} label={m.metric} series={m.series} kind={m.kind} dates={dates} asOfDate={asOfDate} />
                  ))}
                </div>
              ) : (
                <div className="divide-y divide-gray-50 border-t border-gray-100">
                  {metrics.map((m, i) => <MetricRow key={m.metric} m={m} idx={i} asOfDate={asOfDate} dates={dates} />)}
                </div>
              )
            )}
          </div>
        );
      })}
    </div>
  );
}

// Subtotal / rollup metrics -- computed sums or margins rather than raw
// line items, called out the same way the source sheet calls them out: a
// shaded, bold row with a rule above it, not a colour that varies with the
// number. Matched on name alone since a bare "Total" always means the same
// thing wherever it shows up (COGS by supplier, category units, ...).
const SUBTOTAL_METRICS = new Set([
  'Total', 'Total Units Sold', 'Total Labour Cost', 'Total Revenue %', 'Revenue - Total',
  'Gross Revenue', 'Net Revenue', 'Sales Fees', 'PC1 Total', 'PC1 Margin',
  'Operating Profit $', 'Operating Profit %',
]);

// One row of the table view. A per-cell heat scale keyed to each row's own
// min/max reads as a wall of colour once there are enough rows to scan at
// once -- the source sheet's own convention (flat shading that marks a
// row's *role* -- plain line item vs. subtotal -- rather than colouring
// every cell by its value) is both calmer and closer to how a real P&L
// looks, so that's what this reproduces. Percent cells keep red/green text:
// a sign, not a magnitude scale, so it doesn't create the same noise.
function MetricTableRow({ m, dates, idx }) {
  const isSubtotal = SUBTOTAL_METRICS.has(m.metric);
  const base = isSubtotal ? '#f0efe9' : idx % 2 === 1 ? '#fafaf9' : 'white';
  return (
    <tr className={isSubtotal ? 'border-t-2 border-gray-200' : ''}>
      <td
        className={`sticky left-0 z-10 text-sm px-4 py-1.5 border-b border-gray-50 whitespace-nowrap min-w-[220px] ${isSubtotal ? 'italic font-bold text-gray-900' : 'font-medium text-gray-800'}`}
        style={{ background: base }}
      >
        {m.metric}
      </td>
      {dates.map(d => {
        const v = valueAt(m.series, d);
        let color;
        let textClass = isSubtotal ? 'font-semibold text-gray-800' : 'text-gray-700';
        if (v != null && m.kind === 'percent') {
          if (v !== 0) textClass += ' font-semibold';
          color = v > 0 ? GOOD : v < 0 ? BAD : undefined;
        }
        return (
          <td key={d} className={`text-right text-xs tabular-nums px-3 py-1.5 border-b border-gray-50 whitespace-nowrap ${textClass}`} style={{ background: base, color }}>
            {formatMetricValue(v, m.kind)}
          </td>
        );
      })}
    </tr>
  );
}

// Spreadsheet-style scan view: metrics as rows, weeks as columns -- the
// "overall tabulated view" the sheet had and the card/chart views don't
// give you when you just want to eyeball a run of numbers at once.
function MetricTable({ groups, asOfDate, period, defaultOpenCount = 2 }) {
  const dates = useMemo(() => weekAxis(asOfDate, period), [asOfDate, period]);
  const [collapsed, setCollapsed] = useState(() => new Set(groups.slice(defaultOpenCount).map(g => g.section)));
  const scrollRef = useRef(null);
  // Wide tables (26w/52w) overflow horizontally, and the columns run oldest
  // to newest left-to-right -- left unscrolled, the browser default shows
  // the oldest weeks first and the current week is hidden off the right
  // edge. Start scrolled all the way to that edge instead, so the latest
  // week is what's visible without scrolling and scrolling only ever goes
  // further back in time, never forward to "catch up" to the present.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [dates]);
  function toggle(section) {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section); else next.add(section);
      return next;
    });
  }
  if (!groups.length) return <div className="card p-8 text-center text-sm text-gray-400">Nothing to show yet.</div>;
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto" ref={scrollRef}>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-white text-left text-[11px] font-bold text-gray-400 uppercase tracking-wide px-4 py-2 border-b border-gray-100 min-w-[220px]">
                Metric
              </th>
              {dates.map(d => (
                <th key={d} title={fmtWeekRange(d)} className="text-right text-[11px] font-bold text-gray-400 px-3 py-2 border-b border-gray-100 whitespace-nowrap tabular-nums">
                  {fmtWeekLabel(d)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map(({ section, metrics }) => {
              const label = section || 'Summary';
              const isCollapsed = collapsed.has(section);
              return (
                <React.Fragment key={section || '_summary'}>
                  <tr>
                    <td colSpan={dates.length + 1} className="p-0">
                      <SectionHeader label={label} count={metrics.length} isCollapsed={isCollapsed} onClick={() => toggle(section)} sticky />
                    </td>
                  </tr>
                  {!isCollapsed && metrics.map((m, i) => (
                    <MetricTableRow key={m.metric} m={m} dates={dates} idx={i} />
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EmptyChart({ label = 'No data yet' }) {
  return <div className="flex items-center justify-center text-sm text-gray-400" style={{ height: CHART_HEIGHT }}>{label}</div>;
}

// True when at least one row carries a real value for at least one of the
// series being drawn -- distinguishes "no data in this window" (real dates,
// every cell empty, e.g. a metric that stopped updating months ago) from an
// actual empty series, so the chart never renders a bare axis with nothing
// on it and no explanation.
function hasChartData(rows, dataKeys) {
  return rows.some(r => dataKeys.some(k => r[k] != null));
}

function ChartCard({ title, subtitle, children }) {
  return (
    <div className="card p-5">
      <p className="text-base font-bold text-gray-900">{title}</p>
      {subtitle && <p className="text-xs text-gray-400 mb-3">{subtitle}</p>}
      {children}
    </div>
  );
}

// A 0-anchored axis on a series that only ever moves within a narrow band
// (AOV hovering $13-18, say) squashes real week-to-week swings into a
// nearly flat line near the top of the chart. Padding tightly around the
// actual data range instead keeps 0 out of frame (nothing here is ever
// negative) so the same swings read as visible movement. Floors at 0
// regardless, since a padded-down AOV/revenue axis still shouldn't cross it.
function tightYDomain(rows, dataKeys) {
  const vals = rows.flatMap(r => dataKeys.map(k => r[k]).filter(v => v != null));
  if (!vals.length) return undefined;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const pad = (max - min) * 0.15 || Math.abs(max) * 0.1 || 1;
  return [Math.max(0, min - pad), max + pad];
}

function TrendChart({ rows, dataKeys, colors, money, percent, tightDomain }) {
  if (!rows.length || !hasChartData(rows, dataKeys)) return <EmptyChart label="No data in this period" />;
  const yFmt = v => (percent ? fmtPct(v) : money ? fmtMoney(v, { compact: true }) : fmtNumber(v));
  const domain = tightDomain ? tightYDomain(rows, dataKeys) : undefined;
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <LineChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
        <XAxis dataKey="date" tickFormatter={fmtWeekLabel} tick={{ fontSize: 12, fill: AXIS_COLOR }} axisLine={{ stroke: GRID_COLOR }} tickLine={false} minTickGap={28} />
        <YAxis tickFormatter={yFmt} domain={domain} tick={{ fontSize: 12, fill: AXIS_COLOR }} axisLine={false} tickLine={false} width={money ? 64 : 46} />
        <Tooltip labelFormatter={fmtWeekLabel} formatter={v => yFmt(v)} contentStyle={{ fontSize: 13, borderRadius: 8, border: `1px solid ${GRID_COLOR}` }} />
        {dataKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {dataKeys.map((k, i) => (
          <Line key={k} type="monotone" dataKey={k} stroke={dataKeys.length > 1 ? colors[i % colors.length] : 'var(--primary)'} strokeWidth={2.5} dot={false} connectNulls isAnimationActive={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

function StackedBarChart({ rows, dataKeys, colors, money, percent }) {
  if (!rows.length || !hasChartData(rows, dataKeys)) return <EmptyChart label="No data in this period" />;
  const yFmt = v => (percent ? fmtPct(v) : money ? fmtMoney(v, { compact: true }) : fmtNumber(v));
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <BarChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
        <XAxis dataKey="date" tickFormatter={fmtWeekLabel} tick={{ fontSize: 12, fill: AXIS_COLOR }} axisLine={{ stroke: GRID_COLOR }} tickLine={false} minTickGap={28} />
        <YAxis tickFormatter={yFmt} domain={percent ? [0, 1] : undefined} tick={{ fontSize: 12, fill: AXIS_COLOR }} axisLine={false} tickLine={false} width={money ? 64 : 46} />
        <Tooltip labelFormatter={fmtWeekLabel} formatter={v => yFmt(v)} contentStyle={{ fontSize: 13, borderRadius: 8, border: `1px solid ${GRID_COLOR}` }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {dataKeys.map((k, i) => (
          <Bar key={k} dataKey={k} stackId="a" fill={colors[i % colors.length]} radius={i === dataKeys.length - 1 ? [3, 3, 0, 0] : undefined} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// Normalizes each row's dataKeys to fractions of that row's own total, so a
// stacked bar reads as "share of the week" instead of "$ that week" -- same
// shape StackedBarChart already draws, just pre-divided. A $0 week (closure)
// has no share to show, so it's left out rather than divide-by-zero.
function toPercentRows(rows, dataKeys) {
  return rows.map(row => {
    const total = dataKeys.reduce((sum, k) => sum + (row[k] || 0), 0);
    const out = { date: row.date };
    if (!total) return out;
    dataKeys.forEach(k => { if (row[k] != null) out[k] = row[k] / total; });
    return out;
  });
}

// Sums named groups of metrics into {date, [group]: $} rows -- the shared
// shape any "% of the whole" chart reduces to (weekday mix, hour-of-day
// mix, ...): bucket some metrics together per week, then hand the result to
// toPercentRows.
function sumGroupsRows(dates, groups) {
  return dates.map(date => {
    const row = { date };
    groups.forEach(({ label, metrics }) => {
      row[label] = metrics.reduce((sum, m) => sum + (m?.series[date] || 0), 0);
    });
    return row;
  });
}

const MINI_CHART_HEIGHT = 120;

// A single-series, axis-light line chart for a small-multiples grid (one
// card per metric) -- no legend or x-axis labels since the card title
// already names the series and several of these side by side have no room
// for per-chart chrome; the shared Tooltip still gives the exact week and
// value on hover. `kind` drives axis/tooltip formatting the same way every
// other chart on this page is money/percent/count-aware.
function MiniTrendChart({ rows, dataKey, kind }) {
  if (!rows.length || !hasChartData(rows, [dataKey])) {
    return <div style={{ height: MINI_CHART_HEIGHT }} className="flex items-center justify-center text-xs text-gray-300">No data</div>;
  }
  const yFmt = v => formatMetricValue(v, kind);
  return (
    <ResponsiveContainer width="100%" height={MINI_CHART_HEIGHT}>
      <LineChart data={rows} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <XAxis dataKey="date" tick={false} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={yFmt} tick={{ fontSize: 10, fill: AXIS_COLOR }} axisLine={false} tickLine={false} width={kind === 'money' ? 46 : 36} />
        <Tooltip labelFormatter={fmtWeekLabel} formatter={v => yFmt(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${GRID_COLOR}` }} />
        <Line type="monotone" dataKey={dataKey} stroke="var(--primary)" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// One card in a small-multiples grid: name, latest value + WoW delta, and
// its own mini trend line -- used both for the day-of-week share cards and
// (below) any "legacy" KPI section small enough to read well this way.
function MetricMiniCard({ label, series, kind, dates, asOfDate }) {
  const rows = chartRowsForWindow([{ name: label, series }], dates);
  const current = valueAt(series, asOfDate);
  const delta = wowDeltaAt(series, asOfDate);
  return (
    <div className="card p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-bold text-gray-900 truncate">{label}</p>
        <p className="text-sm font-bold text-gray-900 tabular-nums shrink-0">{current != null ? formatMetricValue(current, kind) : '—'}</p>
      </div>
      <DeltaPill delta={delta} />
      <MiniTrendChart rows={rows} dataKey={label} kind={kind} />
    </div>
  );
}

function ItemMoverRow({ r }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{r.name}</p>
        {r.category && <p className="text-[11px] text-gray-400 truncate">{r.category}</p>}
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-semibold text-gray-700 tabular-nums">{fmtMoney(r.current, { compact: true })}</p>
        <p className="text-[11px] font-semibold tabular-nums" style={{ color: r.pct >= 0 ? GOOD : BAD }}>{r.pct >= 0 ? '+' : ''}{fmtPct(r.pct)}</p>
      </div>
    </div>
  );
}

const ITEM_MOVERS_VISIBLE = 10;
// Beyond the top 10, the rest collapses behind a toggle instead of just
// dumping the whole (unbounded) list into the page -- a long tail of
// barely-moved items would otherwise push everything below it off-screen.
// The expanded portion scrolls in its own capped-height panel rather than
// growing the card indefinitely.
function ItemMoversTable({ title, rows, loading }) {
  const [expanded, setExpanded] = useState(false);
  const head = rows?.slice(0, ITEM_MOVERS_VISIBLE) || [];
  const rest = rows?.slice(ITEM_MOVERS_VISIBLE) || [];
  return (
    <div className="card p-4">
      <p className="text-sm font-bold text-gray-900 mb-2">{title}</p>
      {loading ? (
        <div className="flex items-center justify-center h-24 text-gray-300"><Loader2 size={16} className="animate-spin" /></div>
      ) : !rows?.length ? (
        <p className="text-xs text-gray-400 py-6 text-center">Not enough data yet</p>
      ) : (
        <>
          <div className="divide-y divide-gray-100">
            {head.map(r => <ItemMoverRow key={r.name} r={r} />)}
          </div>
          {rest.length > 0 && (
            <>
              {expanded && (
                <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto border-t border-gray-100">
                  {rest.map(r => <ItemMoverRow key={r.name} r={r} />)}
                </div>
              )}
              <button
                onClick={() => setExpanded(e => !e)}
                aria-expanded={expanded}
                className="w-full flex items-center justify-center gap-1 text-xs font-semibold text-gray-400 hover:text-gray-600 pt-2 mt-1 border-t border-gray-100"
              >
                {expanded ? <>Show less <ChevronUp size={12} /></> : <>Show {rest.length} more <ChevronDown size={12} /></>}
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}

// A tab's KPI list can be scanned as cards (sparkline + latest value, good
// for a quick glance) or as a table (every value for every visible week at
// once, good for spotting a trend or an outlier across the period).
// P&L trend: revenue drawn as lines (magnitude, both comfortably positive),
// profit as a bar coloured by sign -- a line for profit reads poorly when
// it's squashed near zero on the same axis as $20k of revenue; a coloured
// bar per week answers "was this week profitable" at a glance instead.
function PnlTrendChart({ rows, lineKeys, barKey, colors }) {
  const allKeys = [...lineKeys, barKey];
  if (!rows.length || !hasChartData(rows, allKeys)) return <EmptyChart label="No data in this period" />;
  const yFmt = v => fmtMoney(v, { compact: true });
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <ComposedChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
        <XAxis dataKey="date" tickFormatter={fmtWeekLabel} tick={{ fontSize: 12, fill: AXIS_COLOR }} axisLine={{ stroke: GRID_COLOR }} tickLine={false} minTickGap={28} />
        <YAxis tickFormatter={yFmt} tick={{ fontSize: 12, fill: AXIS_COLOR }} axisLine={false} tickLine={false} width={64} />
        <Tooltip labelFormatter={fmtWeekLabel} formatter={v => yFmt(v)} contentStyle={{ fontSize: 13, borderRadius: 8, border: `1px solid ${GRID_COLOR}` }} />
        <Legend
          wrapperStyle={{ fontSize: 12 }}
          // A per-week-coloured bar has no single legend swatch to show, so
          // the line series get their normal auto entries and the bar is
          // explained with its own two-state (profit/loss) key instead.
          content={({ payload }) => (
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-2 text-xs">
              {payload.filter(p => p.dataKey !== barKey).map(p => (
                <span key={p.dataKey} className="inline-flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: p.color }} />
                  {p.value}
                </span>
              ))}
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: GOOD }} />
                {barKey} (profit)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: BAD }} />
                {barKey} (loss)
              </span>
            </div>
          )}
        />
        <Bar dataKey={barKey} maxBarSize={28} radius={[3, 3, 3, 3]}>
          {rows.map((r, i) => (
            <Cell key={i} fill={r[barKey] == null ? 'transparent' : r[barKey] >= 0 ? GOOD : BAD} />
          ))}
        </Bar>
        {lineKeys.map((k, i) => (
          <Line key={k} type="monotone" dataKey={k} stroke={colors[i % colors.length]} strokeWidth={2.5} dot={false} connectNulls isAnimationActive={false} />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function ViewToggle({ view, onChange }) {
  return (
    <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
      {[{ id: 'cards', icon: LayoutGrid }, { id: 'table', icon: Table2 }].map(({ id, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          aria-pressed={view === id}
          title={id === 'cards' ? 'Card view' : 'Table view'}
          className="px-2.5 py-1.5 rounded-md transition-colors"
          style={view === id ? { background: 'white', boxShadow: '0 1px 2px rgba(0,0,0,0.08)' } : {}}
        >
          <Icon size={14} className={view === id ? 'text-gray-900' : 'text-gray-400'} />
        </button>
      ))}
    </div>
  );
}

function KpiSection({ title, groups, asOfDate, period, defaultOpenCount, defaultView = 'cards' }) {
  const [view, setView] = useState(defaultView);
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        {title ? <h3 className="text-sm font-bold text-gray-900">{title}</h3> : <div />}
        <ViewToggle view={view} onChange={setView} />
      </div>
      {view === 'cards'
        ? <MetricGroupList groups={groups} defaultOpenCount={defaultOpenCount} asOfDate={asOfDate} period={period} />
        : <MetricTable groups={groups} asOfDate={asOfDate} period={period} defaultOpenCount={defaultOpenCount} />}
    </div>
  );
}

// ── Tabs ─────────────────────────────────────────────────────────────────────

function OverviewTab({ topline, period }) {
  const { asOfDate } = topline;
  const totalRevenueM = findMetric(topline.revenue, 'Revenue', 'Revenue - Total');
  const aovM = findMetric(topline.revenue, 'Customer', 'AOV');
  const customersM = findMetric(topline.revenue, 'Customer', 'Customers');
  const opProfitM = findMetric(topline.budget, '', 'Operating Profit $');
  const opProfitPctM = findMetric(topline.budget, '', 'Operating Profit %');

  const dates = weekAxis(asOfDate, period);
  const revenueChart = totalRevenueM ? chartRowsForWindow([{ name: 'Revenue', series: totalRevenueM.series }], dates) : [];
  const customerChart = customersM ? chartRowsForWindow([{ name: 'Customers', series: customersM.series }], dates) : [];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatTile label="Revenue" value={totalRevenueM ? formatMetricValue(valueAt(totalRevenueM.series, asOfDate), 'money') : '—'} delta={totalRevenueM && wowDeltaAt(totalRevenueM.series, asOfDate)} />
        <StatTile label="AOV" value={aovM ? fmtMoney(valueAt(aovM.series, asOfDate)) : '—'} delta={aovM && wowDeltaAt(aovM.series, asOfDate)} />
        <StatTile label="Customers" value={customersM ? fmtNumber(valueAt(customersM.series, asOfDate)) : '—'} delta={customersM && wowDeltaAt(customersM.series, asOfDate)} />
        <StatTile label="Operating Profit" value={opProfitM ? formatMetricValue(valueAt(opProfitM.series, asOfDate), 'money') : '—'} delta={opProfitM && wowDeltaAt(opProfitM.series, asOfDate)} />
        <StatTile label="Operating Margin" value={opProfitPctM ? fmtPct(valueAt(opProfitPctM.series, asOfDate)) : '—'} delta={opProfitPctM && wowDeltaAt(opProfitPctM.series, asOfDate)} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Revenue" subtitle={`Weekly total, last ${period} weeks`}>
          <TrendChart rows={revenueChart} dataKeys={['Revenue']} colors={CATEGORICAL} money />
        </ChartCard>
        <ChartCard title="Customers" subtitle={`Weekly total, last ${period} weeks`}>
          <TrendChart rows={customerChart} dataKeys={['Customers']} colors={CATEGORICAL} />
        </ChartCard>
      </div>
    </div>
  );
}

const REVENUE_CHANNELS = [
  { key: 'Revenue - In-Store', label: 'In-Store' },
  { key: 'Revenue - UberEats / DD / Hey You', label: '3rd Party Apps' },
  { key: 'Revenue - Catering / B2B', label: 'Catering / B2B' },
  { key: 'Revenue - Classpass / TGTG', label: 'Classpass / TGTG' },
  { key: 'Revenue - Vending', label: 'Vending' },
];
const REVENUE_CATEGORIES = ['Food', 'Drinks', 'Snacks', 'Merch'];

// The composition chart folds the 7 weekdays into 3 groups -- a 7th ad hoc
// palette color beyond the validated 6-color CATEGORICAL set would break
// the dataviz rule that an overflow series folds into a composite rather
// than inventing an unvalidated hue. Each individual day still gets its own
// single-series small-multiple below (module accent color, no palette
// needed for one line). Weekdays are summed (not averaged) so the three
// groups still add to a true 100% of the week.
const WEEKDAY_MIX_GROUPS = ['Weekdays (Mon-Fri)', 'Saturday', 'Sunday'];
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const ALL_WEEKDAYS = [...WEEKDAYS, 'Saturday', 'Sunday'];

// A cafe's trading day folded into 4 dayparts rather than all 12 raw hour
// buckets -- same "no 7th+ ad hoc color" reasoning as the weekday groups,
// and 4 dayparts is a more readable story than 12 thin stack segments.
const HOUR_GROUPS = [
  { label: 'Morning', hours: ['5am-6am', '6am-7am', '7am-8am', '8am-9am'] },
  { label: 'Late Morning', hours: ['9am-10am', '10am-11am'] },
  { label: 'Lunch', hours: ['11am-12pm', '12pm-1pm', '1pm-2pm'] },
  { label: 'Afternoon', hours: ['2pm-3pm', '3pm-4pm', '4pm-5pm'] },
];
const HOUR_GROUP_LABELS = HOUR_GROUPS.map(g => g.label);
const ALL_HOURS = HOUR_GROUPS.flatMap(g => g.hours);

function RevenueTab({ topline, period, itemMovers, itemMoversLoading }) {
  const { asOfDate } = topline;
  const revGroup = topline.revenue;
  const dates = weekAxis(asOfDate, period);
  const channelSeries = REVENUE_CHANNELS
    .map(c => {
      const m = findMetric(revGroup, 'Revenue', c.key);
      return m ? { name: c.label, series: m.series } : null;
    })
    .filter(Boolean);
  const channelRows = chartRowsForWindow(channelSeries, dates);
  const channelShareRows = toPercentRows(channelRows, REVENUE_CHANNELS.map(c => c.label));

  const categorySeries = REVENUE_CATEGORIES
    .map(name => {
      const m = findMetric(revGroup, 'Category Rev.', name);
      return m ? { name, series: m.series } : null;
    })
    .filter(Boolean);
  const categoryRows = chartRowsForWindow(categorySeries, dates);

  const totalM = findMetric(revGroup, 'Revenue', 'Revenue - Total');
  const inStoreM = findMetric(revGroup, 'Revenue', 'Revenue - In-Store');
  const thirdPartyM = findMetric(revGroup, 'Revenue', 'Revenue - UberEats / DD / Hey You');
  const b2bM = findMetric(revGroup, 'Revenue', 'Revenue - Catering / B2B');

  // ── Day-of-week mix ──────────────────────────────────────────────────────
  const dayMs = {};
  ALL_WEEKDAYS.forEach(d => { dayMs[d] = findMetric(revGroup, 'Daily Revenue (In-Store)', d); });
  const dayTotalByDate = {};
  ALL_WEEKDAYS.forEach(d => Object.entries(dayMs[d]?.series || {}).forEach(([date, val]) => {
    dayTotalByDate[date] = (dayTotalByDate[date] || 0) + val;
  }));
  // Share-of-week series per individual day, keyed by date -- feeds both the
  // small-multiples grid below and the Sat/Sun/Weekend stat tiles, so a
  // closure week ($0 total) is excluded from all of them the same way.
  const dayShareSeries = {};
  ALL_WEEKDAYS.forEach(d => {
    dayShareSeries[d] = {};
    Object.entries(dayMs[d]?.series || {}).forEach(([date, val]) => {
      const total = dayTotalByDate[date];
      if (total) dayShareSeries[d][date] = val / total;
    });
  });
  const weekendShareSeries = {};
  Object.keys(dayTotalByDate).forEach(date => {
    const total = dayTotalByDate[date];
    if (!total) return;
    weekendShareSeries[date] = ((dayMs.Saturday?.series[date] || 0) + (dayMs.Sunday?.series[date] || 0)) / total;
  });
  const weekdayMixRows = toPercentRows(
    sumGroupsRows(dates, [
      { label: 'Weekdays (Mon-Fri)', metrics: WEEKDAYS.map(d => dayMs[d]) },
      { label: 'Saturday', metrics: [dayMs.Saturday] },
      { label: 'Sunday', metrics: [dayMs.Sunday] },
    ]),
    WEEKDAY_MIX_GROUPS,
  );

  // ── Time-of-day mix ──────────────────────────────────────────────────────
  const hourMs = {};
  ALL_HOURS.forEach(h => { hourMs[h] = findMetric(revGroup, 'Revenue by Hour', h); });
  const hourTotalByDate = {};
  ALL_HOURS.forEach(h => Object.entries(hourMs[h]?.series || {}).forEach(([date, val]) => {
    hourTotalByDate[date] = (hourTotalByDate[date] || 0) + val;
  }));
  const lunchShareSeries = {};
  const lunchHours = HOUR_GROUPS.find(g => g.label === 'Lunch').hours;
  Object.keys(hourTotalByDate).forEach(date => {
    const total = hourTotalByDate[date];
    if (!total) return;
    lunchShareSeries[date] = lunchHours.reduce((sum, h) => sum + (hourMs[h]?.series[date] || 0), 0) / total;
  });
  const hourMixRows = toPercentRows(
    sumGroupsRows(dates, HOUR_GROUPS.map(g => ({ label: g.label, metrics: g.hours.map(h => hourMs[h]) }))),
    HOUR_GROUP_LABELS,
  );

  // ── Weekend vs weekday AOV ───────────────────────────────────────────────
  // Blended (revenue / customers), not an average of daily AOVs -- averaging
  // 5 unequal-volume weekday AOVs would over-weight a quiet Monday against a
  // busy Friday; dividing summed revenue by summed customers weights each
  // customer equally instead, which is what "AOV" is supposed to mean.
  const custMs = {};
  ALL_WEEKDAYS.forEach(d => { custMs[d] = findMetric(revGroup, 'Daily Customers', d); });
  const weekdayAOVSeries = {}, weekendAOVSeries = {}, blendedAOVSeries = {};
  Object.keys(dayTotalByDate).forEach(date => {
    const wdRev = WEEKDAYS.reduce((sum, d) => sum + (dayMs[d]?.series[date] || 0), 0);
    const wdCust = WEEKDAYS.reduce((sum, d) => sum + (custMs[d]?.series[date] || 0), 0);
    if (wdCust) weekdayAOVSeries[date] = wdRev / wdCust;
    const weRev = (dayMs.Saturday?.series[date] || 0) + (dayMs.Sunday?.series[date] || 0);
    const weCust = (custMs.Saturday?.series[date] || 0) + (custMs.Sunday?.series[date] || 0);
    if (weCust) weekendAOVSeries[date] = weRev / weCust;
    const allCust = ALL_WEEKDAYS.reduce((sum, d) => sum + (custMs[d]?.series[date] || 0), 0);
    if (allCust) blendedAOVSeries[date] = dayTotalByDate[date] / allCust;
  });
  const aovRows = chartRowsForWindow(
    [
      { name: 'Blended AOV', series: blendedAOVSeries },
      { name: 'Weekday AOV', series: weekdayAOVSeries },
      { name: 'Weekend AOV', series: weekendAOVSeries },
    ],
    dates,
  );

  const pctAt = series => (valueAt(series, asOfDate) != null ? fmtPct(valueAt(series, asOfDate)) : '—');
  const moneyAt = series => (valueAt(series, asOfDate) != null ? fmtMoney(valueAt(series, asOfDate)) : '—');

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Total Revenue" value={totalM ? formatMetricValue(valueAt(totalM.series, asOfDate), 'money') : '—'} delta={totalM && wowDeltaAt(totalM.series, asOfDate)} />
        <StatTile label="In-Store" value={inStoreM ? formatMetricValue(valueAt(inStoreM.series, asOfDate), 'money') : '—'} delta={inStoreM && wowDeltaAt(inStoreM.series, asOfDate)} />
        <StatTile label="3rd Party Apps" value={thirdPartyM ? formatMetricValue(valueAt(thirdPartyM.series, asOfDate), 'money') : '—'} delta={thirdPartyM && wowDeltaAt(thirdPartyM.series, asOfDate)} />
        <StatTile label="Catering / B2B" value={b2bM ? formatMetricValue(valueAt(b2bM.series, asOfDate), 'money') : '—'} delta={b2bM && wowDeltaAt(b2bM.series, asOfDate)} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Revenue by Channel" subtitle={`Weekly, last ${period} weeks`}>
          <StackedBarChart rows={channelRows} dataKeys={REVENUE_CHANNELS.map(c => c.label)} colors={CATEGORICAL} money />
        </ChartCard>
        <ChartCard title="Revenue by Category" subtitle={`Food / Drinks / Snacks / Merch, last ${period} weeks`}>
          <StackedBarChart rows={categoryRows} dataKeys={REVENUE_CATEGORIES} colors={CATEGORICAL} money />
        </ChartCard>
      </div>

      <div>
        <h3 className="text-sm font-bold text-gray-900 mb-2">Channel Mix</h3>
        <ChartCard title="Channel Share of Revenue" subtitle={`Same channels as above, as a share of total revenue -- last ${period} weeks`}>
          <StackedBarChart rows={channelShareRows} dataKeys={REVENUE_CHANNELS.map(c => c.label)} colors={CATEGORICAL} percent />
        </ChartCard>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-bold text-gray-900">Day-of-Week Mix</h3>
        <div className="grid grid-cols-3 gap-3">
          <StatTile label="Weekend Share" value={pctAt(weekendShareSeries)} delta={wowDeltaAt(weekendShareSeries, asOfDate)} />
          <StatTile label="Saturday Share" value={pctAt(dayShareSeries.Saturday)} delta={wowDeltaAt(dayShareSeries.Saturday, asOfDate)} />
          <StatTile label="Sunday Share" value={pctAt(dayShareSeries.Sunday)} delta={wowDeltaAt(dayShareSeries.Sunday, asOfDate)} />
        </div>
        <ChartCard title="Weekday Mix" subtitle={`Share of in-store revenue by day-of-week group, last ${period} weeks`}>
          <StackedBarChart rows={weekdayMixRows} dataKeys={WEEKDAY_MIX_GROUPS} colors={CATEGORICAL} percent />
        </ChartCard>
        <div>
          <p className="text-xs text-gray-400 mb-2">Each day's own share of that week's in-store revenue, evolving over the same period</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {ALL_WEEKDAYS.map(d => (
              <MetricMiniCard key={d} label={d} series={dayShareSeries[d]} kind="percent" dates={dates} asOfDate={asOfDate} />
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-bold text-gray-900">Time-of-Day Mix</h3>
        <StatTile label="Lunch Rush Share" value={pctAt(lunchShareSeries)} delta={wowDeltaAt(lunchShareSeries, asOfDate)} />
        <ChartCard title="Revenue by Daypart" subtitle={`Morning / Late Morning / Lunch / Afternoon, share of daily revenue -- last ${period} weeks`}>
          <StackedBarChart rows={hourMixRows} dataKeys={HOUR_GROUP_LABELS} colors={CATEGORICAL} percent />
        </ChartCard>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-bold text-gray-900">Average Order Value</h3>
        <div className="grid grid-cols-3 gap-3">
          <StatTile label="Blended AOV" value={moneyAt(blendedAOVSeries)} delta={wowDeltaAt(blendedAOVSeries, asOfDate)} />
          <StatTile label="Weekday AOV" value={moneyAt(weekdayAOVSeries)} delta={wowDeltaAt(weekdayAOVSeries, asOfDate)} />
          <StatTile label="Weekend AOV" value={moneyAt(weekendAOVSeries)} delta={wowDeltaAt(weekendAOVSeries, asOfDate)} />
        </div>
        <ChartCard title="Average Order Value" subtitle={`Blended AOV (revenue / customers), overall vs weekday vs weekend -- last ${period} weeks`}>
          <TrendChart rows={aovRows} dataKeys={['Blended AOV', 'Weekday AOV', 'Weekend AOV']} colors={CATEGORICAL} money tightDomain />
        </ChartCard>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-bold text-gray-900">Item Movers</h3>
        <p className="text-xs text-gray-400">
          {itemMovers?.currentLabel ? `${itemMovers.currentLabel} vs ${itemMovers.priorLabel}, every channel, items under $20 excluded` : 'Last 4 complete weeks vs the 4 before that'}
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ItemMoversTable title="Top Gainers" rows={itemMovers?.gainers} loading={itemMoversLoading} />
          <ItemMoversTable title="Top Decliners" rows={itemMovers?.decliners} loading={itemMoversLoading} />
        </div>
      </div>

      <KpiSection groups={revGroup} defaultOpenCount={2} asOfDate={asOfDate} period={period} />
    </div>
  );
}

const COGS_SUPPLIERS = ['Foodbyus', 'Ordermentum', 'Supermarket', 'Direct Supply'];

function CostsTab({ topline, period }) {
  const { asOfDate } = topline;
  const costsGroup = topline.costs;
  const dates = weekAxis(asOfDate, period);
  const cogsTotal = findMetric(costsGroup, 'COGS Spend', 'Total');
  const cogsPct = findMetric(costsGroup, 'Average COGS', 'COGS % of Revenue');
  const labourPct = findMetric(costsGroup, 'Labour', 'Labour % Of Revenue');
  const totalLabour = findMetric(costsGroup, 'Labour', 'Total Labour Cost');

  const supplierSeries = COGS_SUPPLIERS
    .map(s => {
      const m = findMetric(costsGroup, 'COGS Spend', s);
      return m ? { name: s, series: m.series } : null;
    })
    .filter(Boolean);
  const supplierRows = chartRowsForWindow(supplierSeries, dates);

  const ratioSeries = [
    cogsPct && { name: 'COGS % of Revenue', series: cogsPct.series },
    labourPct && { name: 'Labour % of Revenue', series: labourPct.series },
  ].filter(Boolean);
  const ratioRows = chartRowsForWindow(ratioSeries, dates);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="COGS" value={cogsTotal ? formatMetricValue(valueAt(cogsTotal.series, asOfDate), 'money') : '—'} delta={cogsTotal && wowDeltaAt(cogsTotal.series, asOfDate)} />
        <StatTile label="COGS % of Revenue" value={cogsPct ? fmtPct(valueAt(cogsPct.series, asOfDate)) : '—'} delta={cogsPct && wowDeltaAt(cogsPct.series, asOfDate)} />
        <StatTile label="Total Labour Cost" value={totalLabour ? formatMetricValue(valueAt(totalLabour.series, asOfDate), 'money') : '—'} delta={totalLabour && wowDeltaAt(totalLabour.series, asOfDate)} />
        <StatTile label="Labour % of Revenue" value={labourPct ? fmtPct(valueAt(labourPct.series, asOfDate)) : '—'} delta={labourPct && wowDeltaAt(labourPct.series, asOfDate)} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="COGS by Supplier" subtitle={`Weekly spend, last ${period} weeks`}>
          <StackedBarChart rows={supplierRows} dataKeys={COGS_SUPPLIERS} colors={CATEGORICAL} money />
        </ChartCard>
        <ChartCard title="COGS % & Labour % of Revenue" subtitle={`Last ${period} weeks`}>
          <TrendChart rows={ratioRows} dataKeys={ratioSeries.map(s => s.name)} colors={[CATEGORICAL[1], CATEGORICAL[4]]} percent />
        </ChartCard>
      </div>
      <KpiSection groups={costsGroup} defaultOpenCount={2} asOfDate={asOfDate} period={period} />
    </div>
  );
}

function CustomerTab({ topline, period }) {
  const { asOfDate } = topline;
  const custGroup = topline.customer;
  const ig = findMetric(custGroup, 'Engagement', 'Instagram Followers');
  const fb = findMetric(custGroup, 'Engagement', 'Facebook Page Likes');
  const tiktok = findMetric(custGroup, 'Engagement', 'TikTok Followers');
  const loyalty = findMetric(custGroup, 'Engagement', 'Loyalty Members');
  const reviews = findMetric(custGroup, 'Customer Sentiment', 'Google Reviews');
  const rating = findMetric(custGroup, 'Customer Sentiment', 'Average Google Rating');

  const followerSeries = [
    ig && { name: 'Instagram', series: ig.series },
    fb && { name: 'Facebook', series: fb.series },
    tiktok && { name: 'TikTok', series: tiktok.series },
  ].filter(Boolean);
  const followerRows = chartRowsForWindow(followerSeries, weekAxis(asOfDate, period));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatTile label="Instagram" value={ig ? fmtNumber(valueAt(ig.series, asOfDate)) : '—'} delta={ig && wowDeltaAt(ig.series, asOfDate)} />
        <StatTile label="Facebook" value={fb ? fmtNumber(valueAt(fb.series, asOfDate)) : '—'} delta={fb && wowDeltaAt(fb.series, asOfDate)} />
        <StatTile label="TikTok" value={tiktok ? fmtNumber(valueAt(tiktok.series, asOfDate)) : '—'} delta={tiktok && wowDeltaAt(tiktok.series, asOfDate)} />
        <StatTile label="Loyalty Members" value={loyalty ? fmtNumber(valueAt(loyalty.series, asOfDate)) : '—'} delta={loyalty && wowDeltaAt(loyalty.series, asOfDate)} />
        <StatTile label="Google Rating" value={rating ? fmtNumber(valueAt(rating.series, asOfDate), { decimals: 1 }) : '—'} delta={rating && wowDeltaAt(rating.series, asOfDate)} />
        <StatTile label="Google Reviews" value={reviews ? fmtNumber(valueAt(reviews.series, asOfDate)) : '—'} delta={reviews && wowDeltaAt(reviews.series, asOfDate)} />
      </div>
      <ChartCard title="Social Followers" subtitle={`Last ${period} weeks`}>
        <TrendChart rows={followerRows} dataKeys={followerSeries.map(s => s.name)} colors={CATEGORICAL} />
      </ChartCard>
      <KpiSection groups={custGroup} defaultOpenCount={2} asOfDate={asOfDate} period={period} />
    </div>
  );
}

const PNL_SUMMARY_METRICS = ['Gross Revenue', 'Net Revenue', 'PC1 Total', 'PC1 Margin', 'Operating Profit $', 'Operating Profit %'];
// Revenue, COGS and Labour give the three biggest levers on profit; Net
// Revenue was dropped in favour of the two cost lines since it tracks
// Gross Revenue too closely to add its own signal on this chart. PC1 Margin
// (gross profit after COGS, before opex) sits between those cost lines and
// Gross Revenue -- a genuinely new layer, unlike PC1 Total which nearly
// overlaps the COGS line already on the chart.
const PNL_TREND_LINES = [
  { section: '', metric: 'Gross Revenue', label: 'Gross Revenue' },
  { section: '', metric: 'PC1 Margin', label: 'PC1 Margin' },
  { section: 'PC1', metric: 'COGS', label: 'COGS' },
  { section: 'Labour', metric: 'Labour Costs (Wages)', label: 'Labour' },
];
// Picked away from the teal/green in CATEGORICAL so a cost line never reads
// like the profit bar's own green.
const PNL_TREND_LINE_COLORS = [CATEGORICAL[0], CATEGORICAL[5], CATEGORICAL[1], CATEGORICAL[3]];
const PNL_TREND_PROFIT_METRIC = 'Operating Profit $';

function PnlTab({ topline, period }) {
  const { asOfDate } = topline;
  const budgetGroup = topline.budget;
  const stats = PNL_SUMMARY_METRICS.map(name => findMetric(budgetGroup, '', name)).filter(Boolean);
  const profitM = findMetric(budgetGroup, '', PNL_TREND_PROFIT_METRIC);
  const trendSeries = [
    ...PNL_TREND_LINES.map(({ section, metric, label }) => {
      const m = findMetric(budgetGroup, section, metric);
      return m ? { name: label, series: m.series } : null;
    }),
    profitM && { name: PNL_TREND_PROFIT_METRIC, series: profitM.series },
  ].filter(Boolean);
  const trendRows = chartRowsForWindow(trendSeries, weekAxis(asOfDate, period));

  const categoryGroups = budgetGroup.filter(g => g.section !== '');
  const summaryGroup = budgetGroup.find(g => g.section === '');

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {stats.map(m => (
          <StatTile key={m.metric} label={m.metric} value={formatMetricValue(valueAt(m.series, asOfDate), m.kind)} delta={wowDeltaAt(m.series, asOfDate)} />
        ))}
      </div>
      <ChartCard title="Gross Revenue, PC1 Margin, COGS & Labour" subtitle={`Weekly, last ${period} weeks — bars show profitable (green) vs loss-making (red) weeks`}>
        <PnlTrendChart rows={trendRows} lineKeys={PNL_TREND_LINES.map(l => l.label)} barKey={PNL_TREND_PROFIT_METRIC} colors={PNL_TREND_LINE_COLORS} />
      </ChartCard>
      {summaryGroup && (
        <KpiSection title="Summary & Ratios" groups={[summaryGroup]} defaultOpenCount={1} defaultView="table" asOfDate={asOfDate} period={period} />
      )}
      <KpiSection title="P&L Line Items" groups={categoryGroups} defaultOpenCount={categoryGroups.length} defaultView="table" asOfDate={asOfDate} period={period} />
    </div>
  );
}

// ── Top level ─────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'revenue', label: 'Revenue' },
  { id: 'costs', label: 'Costs' },
  { id: 'customer', label: 'Customer' },
  { id: 'pnl', label: 'P&L' },
];

function AsOfBanner({ asOfDate }) {
  if (!asOfDate) return null;
  const dataWeek = isoWeekParts(asOfDate);
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const todayWeek = isoWeekParts(todayIso);
  const isCurrent = todayWeek.week === dataWeek.week && todayWeek.year === dataWeek.year;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span
        className="inline-flex items-center gap-1.5 font-semibold px-2.5 py-1 rounded-full"
        style={{ background: 'color-mix(in srgb, var(--primary) 12%, white)', color: 'var(--primary-dk)' }}
      >
        <CalendarDays size={12} />
        Data as of W{String(dataWeek.week).padStart(2, '0')}-{dataWeek.year} ({fmtWeekRange(asOfDate)})
      </span>
      {!isCurrent && (
        <span className="text-gray-400">
          — this is the most recent complete week in the data; today is W{String(todayWeek.week).padStart(2, '0')}-{todayWeek.year}
        </span>
      )}
    </div>
  );
}

function PeriodSelector({ period, onChange }) {
  return (
    <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
      {PERIODS.map(p => (
        <button
          key={p}
          onClick={() => onChange(p)}
          aria-pressed={period === p}
          className="px-2.5 py-1 text-xs font-semibold rounded-md transition-colors tabular-nums"
          style={period === p ? { background: 'var(--primary)', color: 'var(--primary-fg)' } : { color: '#6b7280' }}
        >
          {p}w
        </button>
      ))}
    </div>
  );
}

export default function ToplineApp({ org }) {
  const orgId = org?.id;
  const [topline, setTopline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [period, setPeriod] = useState(26);
  const [itemMovers, setItemMovers] = useState(null);
  const [itemMoversLoading, setItemMoversLoading] = useState(false);

  const load = useCallback(async () => {
    if (!orgId) return;
    try {
      const data = await fetchTopline(orgId);
      setTopline(data);
    } catch (err) {
      toast.error('Failed to load R-Topline data: ' + (err.message || 'unknown error'));
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  // Fixed 4-vs-4-week comparison (see fetchItemMovers) -- doesn't depend on
  // the page's period selector, only on which "as of" week the rest of the
  // dashboard has settled on.
  useEffect(() => {
    if (!orgId || !topline?.asOfDate) return;
    let cancelled = false;
    setItemMoversLoading(true);
    fetchItemMovers(orgId, topline.asOfDate)
      .then(res => { if (!cancelled) setItemMovers(res); })
      .catch(err => { if (!cancelled) toast.error('Failed to load item movers: ' + (err.message || 'unknown error')); })
      .finally(() => { if (!cancelled) setItemMoversLoading(false); });
    return () => { cancelled = true; };
  }, [orgId, topline?.asOfDate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={20} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!topline) {
    return (
      <div className="h-full overflow-auto p-6 max-w-5xl mx-auto" style={{ background: 'var(--app-bg)' }}>
        <div className="card p-8 text-center text-sm text-gray-400">Couldn't load R-Topline data.</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto" style={{ background: 'var(--app-bg)' }}>
      <div className="p-6 max-w-6xl mx-auto space-y-5">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp size={20} style={{ color: 'var(--primary)' }} /> R-Topline
            </h2>
            <PeriodSelector period={period} onChange={setPeriod} />
          </div>
          <p className="text-sm text-gray-400">Revenue, costs & P&L — every KPI from the analytics sheet, natively in R-Shift, reported weekly</p>
          <AsOfBanner asOfDate={topline.asOfDate} />
        </div>

        <div className="flex gap-1 border-b border-gray-100 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px whitespace-nowrap"
              style={activeTab === tab.id ? { borderColor: 'var(--primary)', color: 'var(--primary-dk)' } : { borderColor: 'transparent', color: '#6b7280' }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && <OverviewTab topline={topline} period={period} />}
        {activeTab === 'revenue' && <RevenueTab topline={topline} period={period} itemMovers={itemMovers} itemMoversLoading={itemMoversLoading} />}
        {activeTab === 'costs' && <CostsTab topline={topline} period={period} />}
        {activeTab === 'customer' && <CustomerTab topline={topline} period={period} />}
        {activeTab === 'pnl' && <PnlTab topline={topline} period={period} />}
      </div>
    </div>
  );
}
