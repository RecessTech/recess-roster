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
  // Budget/P&L section order mirrors the row order of the source sheet's
  // own Budget tab (revenue categories, then COGS/gross margin, then
  // operating expenses in the order that sheet lists them, then tax) --
  // alphabetical order buried "PC1" (COGS) in the opex block and put G&A
  // ahead of Labour, which doesn't read like an actual P&L.
  budget: ['', 'B2C', 'B2B', 'PC1', 'Labour', 'Property Costs', 'Shipping', 'Marketing', 'General & Administration', 'Misc.', 'Tax'],
};

// Metric order *within* a budget section, again taken straight from the
// source sheet's own row order rather than alphabetical -- e.g. the sheet
// lists Units Sold before Gross Revenue within B2C, and Kitchen Rent before
// Utilities within Property Costs. Anything not listed here (a metric added
// after this was written) falls back to the general-purpose comparator
// below instead of disappearing.
const METRIC_ORDER = {
  budget: {
    '': [
      '# of Customers per day', '# of Customers per week', 'AOV', 'Total Units Sold',
      'Gross Revenue', 'Sales Fees - UberEats / Doordash', 'Sales Fees - Eatclub', 'Sales Fees',
      'Direct Discounts', 'Payment Processing Costs', 'Net Revenue', 'Avg. COGS $',
      'PC1 Total', 'PC1 Margin', 'Labour Hours (Store)', 'Labour (+Salaries) as % of sales',
      'Rent as % of Sales', 'Marketing as a % of sales', 'Operating Profit $', 'Operating Profit %',
      'Finance Repayments', 'Operating Cashflow', 'Reality Operating Cashflow',
    ],
    'B2C': ['Food Units Sold', 'Drinks Units Sold', 'Snacks Units Sold', 'Food Gross Revenue', 'Drinks Gross Revenue', 'Snacks Gross Revenue', 'UberEats Gross Revenue', 'TGTG / Classpass Revenue'],
    'B2B': ['Catering Gross Revenue', 'Direct B2B Gross Revenue', 'Vending Revenue'],
    'PC1': ['COGS', 'COGS % of Revenue', 'COGs Waste', 'Packaging'],
    'Labour': ['Labour Costs (Wages)', 'Superannuation'],
    'Property Costs': ['Kitchen Rent', 'Equipment Rental', 'Outgoings', 'Parking', 'Utilities', 'Cleaning & Maintenance'],
    'Shipping': ['Delivery Costs'],
    'Marketing': ['Marketing & Socials'],
    'General & Administration': ['Salaries - Clark', 'Salaries - Paddy', 'Accounting & Subscriptions', 'Insurance'],
    'Misc.': ['Stationery and printing', 'Kitchen Consumables'],
    'Tax': ['GST'],
  },
};

function compareMetricNamesFor(tab, section, a, b) {
  const order = METRIC_ORDER[tab] && METRIC_ORDER[tab][section];
  if (order) {
    const ra = order.indexOf(a);
    const rb = order.indexOf(b);
    if (ra !== -1 || rb !== -1) {
      return (ra === -1 ? order.length : ra) - (rb === -1 ? order.length : rb);
    }
  }
  return compareMetricNames(a, b);
}

function sectionRank(tab, section) {
  const order = SECTION_ORDER[tab] || [];
  const idx = order.indexOf(section);
  return idx === -1 ? order.length : idx;
}

// Several sections use weekday or hour-range names as their leaf metric
// ("Monday".."Sunday", "5am-6am".."4pm-5pm") -- alphabetical sort scrambles
// both (e.g. "Friday, Monday, Saturday..." or "10am-11am" before "5am-6am").
// Detected per-name rather than per-section so it applies wherever these
// show up (and a mixed section like "Avg. Revenue by Hour", which also has
// a "Run Rate" metric alongside the hour ranges, still sorts its hour
// entries correctly and just puts the odd one out at the end).
const WEEKDAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const HOUR_RANGE_START = /^(\d{1,2})(am|pm)-/i;

function metricOrderKey(name) {
  const weekdayIdx = WEEKDAY_ORDER.indexOf(name);
  if (weekdayIdx !== -1) return [0, weekdayIdx];
  const hourMatch = name.match(HOUR_RANGE_START);
  if (hourMatch) {
    let hour = parseInt(hourMatch[1], 10) % 12;
    if (hourMatch[2].toLowerCase() === 'pm') hour += 12;
    return [1, hour];
  }
  return [2, name];
}

function compareMetricNames(a, b) {
  const ka = metricOrderKey(a);
  const kb = metricOrderKey(b);
  if (ka[0] !== kb[0]) return ka[0] - kb[0];
  return typeof ka[1] === 'number' ? ka[1] - kb[1] : String(ka[1]).localeCompare(String(kb[1]));
}

// ── Value classification ─────────────────────────────────────────────────────
// The sheet mixes dollars, plain counts and ratios in the same flat metric
// list with no type column, and several sections reuse identical leaf names
// (weekday names, hour ranges, category names) across money AND count
// sections -- e.g. "Revenue by Hour" / "Customers by Hour" / "AOV by Hour"
// all have a metric literally named "5am-6am". Metric name alone can't
// disambiguate those, so classification runs on (tab, section, metric)
// together: percent (has "%") > section overrides (for the ambiguous
// generic-leaf-name sections + the one section that's a ratio without a "%"
// in its name) > count keywords on the metric name > default money, since
// this dataset is overwhelmingly a P&L/revenue sheet.
const COUNT_SECTIONS = new Set(['Customers by Hour', 'Daily Customers', 'Category Units Sold', 'Subcat Units Sold #']);
const PERCENT_SECTIONS = new Set(['COGS Evolution']); // a ratio section the sheet didn't suffix with "%"
const COUNT_METRIC = /\bcustomers?\b|\bfollowers?\b|\bmembers?\b|\breviews?\b|\brating\b|\bhours\b|\bunits?\b|^#\s*of\b/i;

export function classifyMetric(tab, section, metric) {
  // The "%" usually lives on the SECTION (e.g. "Daily Revenue Evolution %"),
  // not the leaf metric name (e.g. "Monday") -- checking metric name alone
  // missed every evolution/share-of/growth section and let them fall
  // through to the money default instead.
  if (metric.includes('%') || section.includes('%') || PERCENT_SECTIONS.has(section)) return 'percent';
  if (COUNT_SECTIONS.has(section)) return 'count';
  if (COUNT_METRIC.test(metric)) return 'count';
  return 'money';
}

export async function fetchTopline(orgId) {
  const [revenue, costs, customer, budget] = await Promise.all([
    db.getAnalyticsMetrics(orgId, 'revenue'),
    db.getAnalyticsMetrics(orgId, 'costs'),
    db.getAnalyticsMetrics(orgId, 'customer'),
    db.getAnalyticsMetrics(orgId, 'budget'),
  ]);
  const all = [
    ...revenue.map(r => ({ ...r, tab: 'revenue' })),
    ...costs.map(r => ({ ...r, tab: 'costs' })),
    ...customer.map(r => ({ ...r, tab: 'customer' })),
    ...budget.map(r => ({ ...r, tab: 'budget' })),
  ];
  const asOfDate = findAsOfDate(all);
  const shape = (tab, rows) => groupBySection(tab, rows, asOfDate);
  return {
    revenue: shape('revenue', revenue),
    costs: shape('costs', costs),
    customer: shape('customer', customer),
    budget: shape('budget', budget),
    asOfDate,
  };
}

// The sheet isn't a live feed -- it's a point-in-time export, and different
// metrics stop at slightly different dates (a stray trailing week with only
// partial data entered for a handful of metrics, a couple of short series
// that started late). Rather than let each metric report its own literal
// last key as "current" -- which is how a partially-entered trailing week
// silently showed up as a $0 "last week's revenue" -- the whole dashboard
// agrees on ONE current week: whichever date the largest number of metrics
// actually end on. Every stat tile and chart reads that same week.
function findAsOfDate(rows) {
  const counts = new Map();
  rows.forEach(r => {
    const dates = Object.keys(r.series || {});
    if (!dates.length) return;
    const last = dates.sort().at(-1);
    counts.set(last, (counts.get(last) || 0) + 1);
  });
  let best = null;
  let bestCount = -1;
  for (const [date, count] of counts) {
    if (count > bestCount || (count === bestCount && date < best)) {
      best = date;
      bestCount = count;
    }
  }
  return best;
}

function groupBySection(tab, rows, asOfDate) {
  const groups = new Map();
  rows.forEach(r => {
    const section = r.section || '';
    if (!groups.has(section)) groups.set(section, []);
    groups.get(section).push({
      metric: r.metric,
      series: clipSeries(r.series || {}, asOfDate),
      kind: classifyMetric(tab, section, r.metric),
    });
  });
  return [...groups.entries()]
    .map(([section, metrics]) => ({
      section,
      metrics: metrics.sort((a, b) => compareMetricNamesFor(tab, section, a.metric, b.metric)),
    }))
    .sort((a, b) => sectionRank(tab, a.section) - sectionRank(tab, b.section) || a.section.localeCompare(b.section));
}

// Drop anything after the dashboard's agreed "as of" week -- a metric with a
// stray/partial entry beyond that point (see findAsOfDate) should never
// surface in a chart, table or "latest" tile, not even as a trailing blip.
function clipSeries(series, asOfDate) {
  if (!asOfDate) return series;
  const out = {};
  for (const date of Object.keys(series)) {
    if (date <= asOfDate) out[date] = series[date];
  }
  return out;
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

// The value at a specific (dashboard-wide) reporting week, not whatever this
// particular series happens to end on -- see findAsOfDate. Null if this
// metric simply has no data for that week (a genuinely shorter series),
// which renders as "—" rather than a misleading 0 or a stale older value.
export function valueAt(series, date) {
  if (!date || !(date in series)) return null;
  return series[date];
}

// Week-over-week delta anchored to a specific date and the entry immediately
// before it IN THIS SERIES (not necessarily exactly 7 days earlier, since a
// closure week is sometimes simply absent rather than recorded as zero).
export function wowDeltaAt(series, date) {
  const dates = sortedDates(series);
  const idx = dates.indexOf(date);
  if (idx <= 0) return null;
  const latest = series[dates[idx]];
  const prev = series[dates[idx - 1]];
  if (prev === 0 || prev == null || latest == null) return null;
  return (latest - prev) / Math.abs(prev);
}

// Legacy alias kept for call sites that just want "latest two points,
// whatever they are" (sparkline-adjacent contexts, not stat tiles that need
// to agree on a single current week).
export function wowDelta(series) {
  const dates = sortedDates(series);
  if (dates.length < 2) return null;
  return wowDeltaAt(series, dates.at(-1));
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

// The last N week-start dates up to (and including) the dashboard's as-of
// week, shared by every chart/table so "8 weeks" always means the same 8
// calendar weeks no matter which metric is being drawn.
export function lastNDates(series, n, asOfDate) {
  const dates = sortedDates(series).filter(d => !asOfDate || d <= asOfDate);
  return dates.slice(-n);
}

// Chart rows for a fixed set of weeks (see weekAxis) rather than "however
// many of this series' own dates happen to exist" -- a metric that stopped
// updating early (e.g. a manually-tracked social stat) must show as a gap
// in the current window, not silently shift the whole chart's x-axis back
// to whenever that metric last had data.
export function chartRowsForWindow(namedSeries, dates) {
  return dates.map(date => {
    const row = { date };
    namedSeries.forEach(({ name, series }) => {
      if (series[date] != null) row[name] = series[date];
    });
    return row;
  });
}

// A fixed Monday-by-Monday date axis ending at asOfDate, walked backward by
// calendar arithmetic rather than read off any one metric's own keys -- so
// every chart/table column means the same calendar week for every metric,
// even metrics with a gap (an absent closure week) somewhere in the range.
export function weekAxis(asOfDate, n) {
  if (!asOfDate) return [];
  const end = new Date(asOfDate + 'T12:00:00Z');
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - i * 7);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

// ISO-8601 week number -- the sheet's week-start dates are always Mondays,
// which is exactly what ISO weeks are anchored to, so this lines up cleanly
// with no off-by-one drift at year boundaries.
export function isoWeekParts(iso) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return { week, year: d.getUTCFullYear() };
}

export function fmtWeekLabel(iso) {
  const { week, year } = isoWeekParts(iso);
  return `W${String(week).padStart(2, '0')}-${year}`;
}

// "24 – 30 Aug 2026" -- the Monday-to-Sunday span a week-start date covers,
// for the one place per screen that should spell out what a week means.
export function fmtWeekRange(iso) {
  const start = new Date(iso + 'T12:00:00Z');
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const dayMonth = d => d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const year = end.getUTCFullYear();
  return `${dayMonth(start)} – ${dayMonth(end)} ${year}`;
}

// Large figures (revenue totals, COGS spend, ...) read better as whole
// dollars or a compact "$24.2k"; small per-unit figures (AOV, average COGS
// per unit, hourly rates) lose the number that actually matters -- the
// cents -- if rounded the same way, so anything under $1,000 keeps 2dp.
export function fmtMoney(n, { compact = false } = {}) {
  if (n == null || Number.isNaN(n)) return '—';
  if (compact && Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  const small = Math.abs(n) < 1000;
  return n.toLocaleString('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: small ? 2 : 0,
    maximumFractionDigits: small ? 2 : 0,
  });
}

export function fmtNumber(n, { decimals = 0 } = {}) {
  if (n == null || Number.isNaN(n)) return '—';
  return n.toLocaleString('en-AU', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function fmtPct(n, { decimals = 1 } = {}) {
  if (n == null || Number.isNaN(n)) return '—';
  return `${(n * 100).toFixed(decimals)}%`;
}

// Kept for any external call site that only has a metric name and genuinely
// has no section context -- prefer classifyMetric(tab, section, metric)
// wherever a section is available, since name alone is ambiguous for the
// generic-leaf-name sections (see classifyMetric's comment).
export function isPercentMetric(metricName) {
  return metricName.includes('%');
}
export function isMoneyMetric(metricName) {
  return !isPercentMetric(metricName) && !COUNT_METRIC.test(metricName);
}

// Value formatter driven by a metric's classified kind ('money'|'percent'|'count').
export function formatMetricValue(value, kind, opts = {}) {
  if (value == null || Number.isNaN(value)) return '—';
  if (kind === 'percent') return fmtPct(value);
  if (kind === 'money') return fmtMoney(value, { compact: true, ...opts });
  return fmtNumber(value, { decimals: Number.isInteger(value) ? 0 : 1, ...opts });
}

export function findMetricAnywhere(groups, metricName) {
  for (const g of groups) {
    const m = g.metrics.find(x => x.metric === metricName);
    if (m) return m;
  }
  return null;
}
