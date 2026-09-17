import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { TrendingUp, Loader2, ChevronDown, ChevronUp, ArrowUpRight, ArrowDownRight, Table2, LayoutGrid, CalendarDays } from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, ComposedChart, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import toast from 'react-hot-toast';
import {
  fetchTopline, sortedDates, valueAt, wowDeltaAt, chartRowsForWindow, findMetric, weekAxis,
  fmtWeekLabel, fmtWeekRange, fmtMoney, fmtNumber, fmtPct, formatMetricValue, isoWeekParts,
} from './toplineData';

// Validated categorical palette, bookended with R-Shift's own brand orange
// and blue (rather than the generic dataviz-reference hues in those slots)
// so multi-series charts read as "this app's colours", with three more
// validated hues filling the gap and the two greens kept apart -- that
// pairing barely cleared the CVD floor and was genuinely hard to tell apart
// in a 4-series stacked bar. Re-validated as its own theme: worst adjacent
// normal-vision Delta E 28.3, both light-mode gates clear. Used for anything
// with 2+ series. Single-series charts use the module's own accent
// (var(--primary), R-Shift blue) instead, so a lone trend line still reads
// as "this module's colour", not just "series 1".
const CATEGORICAL = ['#E85018', '#4a3aa7', '#1baf7a', '#e87ba4', '#008300', '#3B5BDB'];
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

function Sparkline({ series, color, period }) {
  const dates = sortedDates(series).slice(-Math.min(period, 20));
  if (dates.length < 2) return <div style={{ width: 90, height: 28 }} />;
  const data = dates.map(d => ({ date: d, value: series[d] }));
  return (
    <div style={{ width: 90, height: 28 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function MetricRow({ m, idx, asOfDate }) {
  const value = valueAt(m.series, asOfDate);
  const delta = wowDeltaAt(m.series, asOfDate);
  return (
    <div className={`flex items-center justify-between gap-3 px-4 py-2 ${idx % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
      <p className="text-sm font-medium text-gray-800 truncate flex-1 min-w-0">{m.metric}</p>
      <Sparkline series={m.series} color="var(--primary)" period={16} />
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

function MetricGroupList({ groups, defaultOpenCount = 2, asOfDate }) {
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
        return (
          <div key={section || '_summary'} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <SectionHeader label={label} count={metrics.length} isCollapsed={isCollapsed} onClick={() => toggle(section)} />
            {!isCollapsed && (
              <div className="divide-y divide-gray-50 border-t border-gray-100">
                {metrics.map((m, i) => <MetricRow key={m.metric} m={m} idx={i} asOfDate={asOfDate} />)}
              </div>
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

function TrendChart({ rows, dataKeys, colors, money, percent }) {
  if (!rows.length || !hasChartData(rows, dataKeys)) return <EmptyChart label="No data in this period" />;
  const yFmt = v => (percent ? fmtPct(v) : money ? fmtMoney(v, { compact: true }) : fmtNumber(v));
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <LineChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
        <XAxis dataKey="date" tickFormatter={fmtWeekLabel} tick={{ fontSize: 12, fill: AXIS_COLOR }} axisLine={{ stroke: GRID_COLOR }} tickLine={false} minTickGap={28} />
        <YAxis tickFormatter={yFmt} tick={{ fontSize: 12, fill: AXIS_COLOR }} axisLine={false} tickLine={false} width={money ? 64 : 46} />
        <Tooltip labelFormatter={fmtWeekLabel} formatter={v => yFmt(v)} contentStyle={{ fontSize: 13, borderRadius: 8, border: `1px solid ${GRID_COLOR}` }} />
        {dataKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {dataKeys.map((k, i) => (
          <Line key={k} type="monotone" dataKey={k} stroke={dataKeys.length > 1 ? colors[i % colors.length] : 'var(--primary)'} strokeWidth={2.5} dot={false} connectNulls isAnimationActive={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

function StackedBarChart({ rows, dataKeys, colors, money }) {
  if (!rows.length || !hasChartData(rows, dataKeys)) return <EmptyChart label="No data in this period" />;
  const yFmt = v => (money ? fmtMoney(v, { compact: true }) : fmtNumber(v));
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <BarChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
        <XAxis dataKey="date" tickFormatter={fmtWeekLabel} tick={{ fontSize: 12, fill: AXIS_COLOR }} axisLine={{ stroke: GRID_COLOR }} tickLine={false} minTickGap={28} />
        <YAxis tickFormatter={yFmt} tick={{ fontSize: 12, fill: AXIS_COLOR }} axisLine={false} tickLine={false} width={money ? 64 : 46} />
        <Tooltip labelFormatter={fmtWeekLabel} formatter={v => yFmt(v)} contentStyle={{ fontSize: 13, borderRadius: 8, border: `1px solid ${GRID_COLOR}` }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {dataKeys.map((k, i) => (
          <Bar key={k} dataKey={k} stackId="a" fill={colors[i % colors.length]} radius={i === dataKeys.length - 1 ? [3, 3, 0, 0] : undefined} />
        ))}
      </BarChart>
    </ResponsiveContainer>
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
        ? <MetricGroupList groups={groups} defaultOpenCount={defaultOpenCount} asOfDate={asOfDate} />
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

function RevenueTab({ topline, period }) {
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
const PNL_TREND_REVENUE_METRICS = ['Gross Revenue', 'Net Revenue'];
const PNL_TREND_PROFIT_METRIC = 'Operating Profit $';

function PnlTab({ topline, period }) {
  const { asOfDate } = topline;
  const budgetGroup = topline.budget;
  const stats = PNL_SUMMARY_METRICS.map(name => findMetric(budgetGroup, '', name)).filter(Boolean);
  const profitM = findMetric(budgetGroup, '', PNL_TREND_PROFIT_METRIC);
  const trendSeries = [
    ...PNL_TREND_REVENUE_METRICS.map(name => {
      const m = findMetric(budgetGroup, '', name);
      return m ? { name, series: m.series } : null;
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
      <ChartCard title="Gross Revenue, Net Revenue & Operating Profit" subtitle={`Weekly, last ${period} weeks — bars show profitable (green) vs loss-making (red) weeks`}>
        <PnlTrendChart rows={trendRows} lineKeys={PNL_TREND_REVENUE_METRICS} barKey={PNL_TREND_PROFIT_METRIC} colors={CATEGORICAL} />
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
        {activeTab === 'revenue' && <RevenueTab topline={topline} period={period} />}
        {activeTab === 'costs' && <CostsTab topline={topline} period={period} />}
        {activeTab === 'customer' && <CustomerTab topline={topline} period={period} />}
        {activeTab === 'pnl' && <PnlTab topline={topline} period={period} />}
      </div>
    </div>
  );
}
