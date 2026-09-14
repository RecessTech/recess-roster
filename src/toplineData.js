// R-Topline data-shaping layer -- turns the flat (tab, section, metric, series)
// rows from `analytics_metrics` into the grouped, chart-ready shapes the UI
// needs. One row per named time series (see supabaseClient.js's R-Topline
// section for why), so all the date-alignment / latest-value / WoW-delta work
// that would otherwise live in the UI happens once, here.
import { db } from './supabaseClient';

// A handful of sections read better pinned to the top of their tab (mirroring
// the source sheet's own layout) -- everything else falls back to alphabetical.
const SECTION_ORDER = {
  revenue: ['Revenue', 'Customer', 'Key Metric Evolution %'],
  costs: ['COGS Spend', 'COGS Evolution', 'Average COGS', 'Labour'],
  customer: ['Engagement', 'Customer Sentiment'],
  budget: [''],
};

function sectionRank(tab, section) {
  const order = SECTION_ORDER[tab] || [];
  const idx = order.indexOf(section);
  return idx === -1 ? order.length : idx;
}

export async function fetchTopline(orgId) {
  const [revenue, costs, customer, budget] = await Promise.all([
    db.getAnalyticsMetrics(orgId, 'revenue'),
    db.getAnalyticsMetrics(orgId, 'costs'),
    db.getAnalyticsMetrics(orgId, 'customer'),
    db.getAnalyticsMetrics(orgId, 'budget'),
  ]);
  const shape = (tab, rows) => groupBySection(tab, rows);
  return {
    revenue: shape('revenue', revenue),
    costs: shape('costs', costs),
    customer: shape('customer', customer),
    budget: shape('budget', budget),
  };
}

function groupBySection(tab, rows) {
  const groups = new Map();
  rows.forEach(r => {
    const section = r.section || '';
    if (!groups.has(section)) groups.set(section, []);
    groups.get(section).push({ metric: r.metric, series: r.series || {} });
  });
  return [...groups.entries()]
    .map(([section, metrics]) => ({
      section,
      metrics: metrics.sort((a, b) => a.metric.localeCompare(b.metric)),
    }))
    .sort((a, b) => sectionRank(tab, a.section) - sectionRank(tab, b.section) || a.section.localeCompare(b.section));
}

// -- per-series helpers --------------------------------------------------

export function sortedDates(series) {
  return Object.keys(series).sort();
}

export function latestEntry(series) {
  const dates = sortedDates(series);
  if (dates.length === 0) return null;
  const date = dates[dates.length - 1];
  return { date, value: series[date] };
}

// Week-over-week delta off the latest two dates present in the series --
// not necessarily adjacent calendar weeks, since some weeks (closures) are
// simply absent from the sheet rather than recorded as zero.
export function wowDelta(series) {
  const dates = sortedDates(series);
  if (dates.length < 2) return null;
  const latest = series[dates[dates.length - 1]];
  const prev = series[dates[dates.length - 2]];
  if (prev === 0 || prev == null || latest == null) return null;
  return (latest - prev) / Math.abs(prev);
}

export function findMetric(group, section, metric) {
  const g = group.find(x => x.section === section);
  if (!g) return null;
  return g.metrics.find(m => m.metric === metric) || null;
}

// Merge several named series onto one shared, sorted date axis -- the shape
// Recharts wants: [{ date, [name1]: v, [name2]: v, ... }, ...].
export function toChartRows(namedSeries) {
  const dateSet = new Set();
  namedSeries.forEach(({ series }) => Object.keys(series).forEach(d => dateSet.add(d)));
  const dates = [...dateSet].sort();
  return dates.map(date => {
    const row = { date };
    namedSeries.forEach(({ name, series }) => {
      if (series[date] != null) row[name] = series[date];
    });
    return row;
  });
}

// ISO-8601 week number -- the sheet's week-start dates are always Mondays,
// which is exactly what ISO weeks are anchored to, so this lines up cleanly
// with no off-by-one drift at year boundaries.
export function fmtWeekLabel(iso) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `W${String(week).padStart(2, '0')}-${d.getUTCFullYear()}`;
}

export function fmtMoney(n, { compact = false } = {}) {
  if (n == null || Number.isNaN(n)) return '—';
  if (compact && Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });
}

export function fmtNumber(n, { decimals = 0 } = {}) {
  if (n == null || Number.isNaN(n)) return '—';
  return n.toLocaleString('en-AU', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function fmtPct(n, { decimals = 1 } = {}) {
  if (n == null || Number.isNaN(n)) return '—';
  return `${(n * 100).toFixed(decimals)}%`;
}

// Metrics whose values are already ratios (0-1) rather than dollars/counts --
// the sheet marks these with a "%" somewhere in the metric's own name (not
// always at the end, e.g. "Labour (+Salaries) as % of sales").
export function isPercentMetric(metricName) {
  return metricName.includes('%');
}

const MONEY_METRIC = /revenue|cogs|cost|wage|salar|rent|spend|price|profit|cashflow|repayment|discount|fee/i;
export function isMoneyMetric(metricName) {
  return MONEY_METRIC.test(metricName);
}

// Best-effort value formatter driven entirely by the metric's own name --
// there's no per-metric config table, so this heuristic is what lets 250+
// sheet metrics render sensibly without being hand-mapped one by one.
export function formatMetricValue(value, metricName) {
  if (value == null || Number.isNaN(value)) return '—';
  if (isPercentMetric(metricName)) return fmtPct(value);
  if (isMoneyMetric(metricName)) return fmtMoney(value, { compact: true });
  return fmtNumber(value, { decimals: Number.isInteger(value) ? 0 : 1 });
}

export function findMetricAnywhere(groups, metricName) {
  for (const g of groups) {
    const m = g.metrics.find(x => x.metric === metricName);
    if (m) return m;
  }
  return null;
}
