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
const COUNT_METRIC = /\bcustomers?\b|\bfollowers?\b|\bmembers?\b|\breviews?\b|\brating\b|\bhours\b|\bunits?\b|\blikes?\b|^#\s*of\b/i;

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

// Which direction of movement is *good* for a metric -- revenue/count/profit
// metrics default to "up is good", but a cost line reads backwards under
// that default: rising COGS or Labour spend is bad, not good. The 'costs'
// tab is entirely expense metrics by definition; a handful of budget-tab
// sections are too (COGS, Labour, rent, shipping, marketing, G&A, misc,
// tax). The budget tab's '' (summary) section flattens cost line items
// (Sales Fees, Payment Processing, Direct Discounts, ...) in together with
// revenue/profit ones, so those need matching by name instead of section.
const COST_SECTIONS = new Set([
  'PC1', 'Labour', 'Property Costs', 'Shipping', 'Marketing',
  'General & Administration', 'Misc.', 'Tax',
]);
const COST_METRIC_NAMES = new Set([
  'Avg. COGS $', 'Direct Discounts', 'Finance Repayments', 'Payment Processing Costs',
  'Sales Fees', 'Sales Fees - Eatclub', 'Sales Fees - UberEats / Doordash',
  'Labour (+Salaries) as % of sales', 'Marketing as a % of sales', 'Rent as % of Sales',
]);

export function isCostMetric(tab, section, metric) {
  if (tab === 'costs') return true;
  if (COST_SECTIONS.has(section)) return true;
  return COST_METRIC_NAMES.has(metric);
}

// Reads a WoW/period delta against a metric's own good direction -- null
// (no data) stays null rather than reading as either color. `direction`
// is 'down' for a cost metric, anything else (including undefined, for
// call sites with no direction to give) defaults to the usual "up is good".
export function deltaGood(delta, direction) {
  if (delta == null) return null;
  return direction === 'down' ? delta <= 0 : delta >= 0;
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

// "What's actually moving" at the menu-item level: total revenue (every
// channel) over the most recent 4 complete weeks vs. the 4 weeks before
// that. Fixed at 4-vs-4 rather than following the page's period selector --
// a 52-week comparison would be mostly noise for "what's trending right
// now", and would also mean fetching a year of raw sales_history rows for
// a stat tile. asOfDate is the Monday of the last COMPLETE week (see
// findAsOfDate), so the current window ends there -- it runs backward from
// that week's Sunday, not forward from asOfDate into weeks with no data yet.
const ITEM_MOVER_WEEKS = 4;
const MIN_ITEM_MOVER_VOLUME = 20; // ignore items too small for a % move to mean anything

export async function fetchItemMovers(orgId, asOfDate) {
  if (!orgId || !asOfDate) return { gainers: [], decliners: [] };
  const fmt = d => d.toISOString().slice(0, 10);
  const spanDays = ITEM_MOVER_WEEKS * 7;

  const curEnd = new Date(asOfDate + 'T12:00:00Z');
  curEnd.setUTCDate(curEnd.getUTCDate() + 6); // Sunday of the as-of week
  const curStart = new Date(curEnd);
  curStart.setUTCDate(curStart.getUTCDate() - spanDays + 1);
  const priorEnd = new Date(curStart);
  priorEnd.setUTCDate(priorEnd.getUTCDate() - 1);
  const priorStart = new Date(priorEnd);
  priorStart.setUTCDate(priorStart.getUTCDate() - spanDays + 1);

  const [rows, items] = await Promise.all([
    db.getItemSalesByRange(orgId, fmt(priorStart), fmt(curEnd)),
    db.getProductionItems(orgId),
  ]);
  const itemById = new Map(items.map(i => [i.id, i]));
  const curStartKey = fmt(curStart);

  const totals = new Map(); // item_id -> { current, prior }
  rows.forEach(r => {
    const bucket = r.sale_date >= curStartKey ? 'current' : 'prior';
    const t = totals.get(r.item_id) || { current: 0, prior: 0 };
    t[bucket] += Number(r.revenue) || 0;
    totals.set(r.item_id, t);
  });

  const moves = [...totals.entries()]
    .map(([itemId, t]) => ({
      name: itemById.get(itemId)?.name || 'Unknown item',
      category: itemById.get(itemId)?.category || '',
      current: t.current,
      prior: t.prior,
      pct: t.prior > 0 ? (t.current - t.prior) / t.prior : null,
    }))
    // A brand-new item (zero prior revenue) has no meaningful % move --
    // excluded from gainers/decliners rather than shown as an infinite gain.
    .filter(r => r.pct != null && Math.max(r.current, r.prior) >= MIN_ITEM_MOVER_VOLUME);

  // Full sorted lists (every actual gainer / actual decliner, not just a
  // top-N slice) -- the UI shows the first 10 and lets the rest scroll open
  // on demand. Split by sign first: without it, "decliners" was the same
  // full pool as "gainers" just sorted the other way, so expanding either
  // list eventually surfaced items moving the wrong direction.
  return {
    gainers: moves.filter(r => r.pct > 0).sort((a, b) => b.pct - a.pct),
    decliners: moves.filter(r => r.pct < 0).sort((a, b) => a.pct - b.pct),
    currentLabel: `${fmt(curStart)} – ${fmt(curEnd)}`,
    priorLabel: `${fmt(priorStart)} – ${fmt(priorEnd)}`,
  };
}

// Raw sales_history.channel values -> the same channel labels the rest of
// the Revenue tab uses. Only 3 show up in the line-item data (Catering/B2B
// and Vending are tracked in aggregate only, never per-item), which is
// exactly what the subcategory channel-mix chart below is honest about --
// it shows the mix of what's actually itemized, not the full channel list.
const CHANNEL_LABELS = { pos: 'In-Store', ubereats: '3rd Party Apps', doordash: '3rd Party Apps', classpass: 'Classpass / TGTG' };

function weekdayGroupOf(dateStr) {
  const day = new Date(dateStr + 'T12:00:00Z').getUTCDay(); // 0=Sun..6=Sat
  if (day === 0) return 'Sunday';
  if (day === 6) return 'Saturday';
  return 'Weekdays (Mon-Fri)';
}

const SUBCAT_MOVER_WEEKS = 4; // mirrors ITEM_MOVER_WEEKS -- same comparison window, one level up
const MIN_SUBCAT_MOVER_VOLUME = 50;
const PARETO_TOP_N = 3;

// Six subcategory-level views, all derived from the same single pass over
// raw sales_history + production_items -- there's no pre-aggregated
// "subcategory x channel" or "subcategory x weekday" series anywhere in
// analytics_metrics, so this reads line items directly the same way
// fetchItemMovers does, then rolls them up by category instead of by item.
export async function fetchSubcategoryInsights(orgId, asOfDate, period) {
  if (!orgId || !asOfDate) return null;
  const fmt = d => d.toISOString().slice(0, 10);

  const dates = weekAxis(asOfDate, period);
  const periodStart = dates[0];
  const endDate = new Date(asOfDate + 'T12:00:00Z');
  endDate.setUTCDate(endDate.getUTCDate() + 6); // Sunday of the as-of week
  const periodEnd = fmt(endDate);

  // Fixed 4-vs-4-week window for movers and the price/volume split -- same
  // reasoning as fetchItemMovers: a stable "what's trending right now"
  // comparison shouldn't stretch or shrink with the page's period selector.
  const spanDays = SUBCAT_MOVER_WEEKS * 7;
  const curStart = new Date(endDate);
  curStart.setUTCDate(curStart.getUTCDate() - spanDays + 1);
  const priorEnd = new Date(curStart);
  priorEnd.setUTCDate(priorEnd.getUTCDate() - 1);
  const priorStart = new Date(priorEnd);
  priorStart.setUTCDate(priorStart.getUTCDate() - spanDays + 1);
  const curStartKey = fmt(curStart);
  const priorStartKey = fmt(priorStart);

  // One fetch wide enough to cover both windows -- the period window (which
  // follows the page's 4/8/12/26/52-week selector) and the fixed 4-vs-4
  // mover window, whichever starts earlier.
  const fetchStart = periodStart < priorStartKey ? periodStart : priorStartKey;

  const [rows, items] = await Promise.all([
    db.getItemSalesByRange(orgId, fetchStart, periodEnd),
    db.getProductionItems(orgId),
  ]);
  const itemById = new Map(items.map(i => [i.id, i]));
  const activeCountByCategory = new Map();
  items.forEach(i => {
    if (!i.active || !i.category) return;
    activeCountByCategory.set(i.category, (activeCountByCategory.get(i.category) || 0) + 1);
  });

  const periodTotals = new Map();  // category -> { revenue, qty }
  const moverTotals = new Map();   // category -> { current, prior, curQty, priorQty }
  const channelTotals = new Map(); // category -> { [channelLabel]: revenue }
  const dayTotals = new Map();     // category -> { [dayGroup]: revenue }
  const itemTotals = new Map();    // category -> Map(itemId -> revenue), period window only

  rows.forEach(r => {
    const category = itemById.get(r.item_id)?.category;
    if (!category) return; // unclassified line items carry no subcategory story to tell
    const revenue = Number(r.revenue) || 0;
    const qty = Number(r.qty) || 0;

    if (r.sale_date >= periodStart && r.sale_date <= periodEnd) {
      const pt = periodTotals.get(category) || { revenue: 0, qty: 0 };
      pt.revenue += revenue; pt.qty += qty;
      periodTotals.set(category, pt);

      const channelLabel = CHANNEL_LABELS[r.channel] || 'Other';
      const ct = channelTotals.get(category) || {};
      ct[channelLabel] = (ct[channelLabel] || 0) + revenue;
      channelTotals.set(category, ct);

      const dayGroup = weekdayGroupOf(r.sale_date);
      const dt = dayTotals.get(category) || {};
      dt[dayGroup] = (dt[dayGroup] || 0) + revenue;
      dayTotals.set(category, dt);

      const it = itemTotals.get(category) || new Map();
      it.set(r.item_id, (it.get(r.item_id) || 0) + revenue);
      itemTotals.set(category, it);
    }

    if (r.sale_date >= priorStartKey && r.sale_date <= periodEnd) {
      const bucket = r.sale_date >= curStartKey ? 'current' : 'prior';
      const mt = moverTotals.get(category) || { current: 0, prior: 0, curQty: 0, priorQty: 0 };
      mt[bucket] += revenue;
      mt[bucket === 'current' ? 'curQty' : 'priorQty'] += qty;
      moverTotals.set(category, mt);
    }
  });

  // #1 Menu efficiency: revenue per active menu item, this period. A
  // subcategory earning less than another while spread across far more
  // active SKUs is a menu-rationalization candidate.
  const efficiency = [...periodTotals.entries()]
    .map(([category, t]) => {
      const activeItems = activeCountByCategory.get(category) || 0;
      return { category, revenue: t.revenue, activeItems, revenuePerItem: activeItems ? t.revenue / activeItems : null };
    })
    .filter(r => r.revenuePerItem != null)
    .sort((a, b) => b.revenuePerItem - a.revenuePerItem);

  // #2 / #3 Price-mix vs volume decomposition, and subcategory movers --
  // both fall out of the same current-vs-prior split. Revenue growth from
  // more units sold (qtyPct) reads very differently to a category than
  // growth from a higher average selling price (aspPct); moversPct is the
  // same current-vs-prior split rolled up to gainers/decliners lists in
  // the same shape fetchItemMovers already uses.
  const decomposed = [...moverTotals.entries()]
    .map(([category, t]) => {
      const aspCurrent = t.curQty ? t.current / t.curQty : null;
      const aspPrior = t.priorQty ? t.prior / t.priorQty : null;
      return {
        category,
        revenueCurrent: t.current,
        revenuePrior: t.prior,
        revenuePct: t.prior > 0 ? (t.current - t.prior) / t.prior : null,
        qtyPct: t.priorQty > 0 ? (t.curQty - t.priorQty) / t.priorQty : null,
        aspPct: aspPrior > 0 && aspCurrent != null ? (aspCurrent - aspPrior) / aspPrior : null,
      };
    })
    .filter(r => Math.max(r.revenueCurrent, r.revenuePrior) >= MIN_SUBCAT_MOVER_VOLUME && r.revenuePct != null);

  const movers = {
    gainers: decomposed
      .filter(r => r.revenuePct > 0)
      .map(r => ({ name: r.category, current: r.revenueCurrent, pct: r.revenuePct }))
      .sort((a, b) => b.pct - a.pct),
    decliners: decomposed
      .filter(r => r.revenuePct < 0)
      .map(r => ({ name: r.category, current: r.revenueCurrent, pct: r.revenuePct }))
      .sort((a, b) => a.pct - b.pct),
    currentLabel: `${curStartKey} – ${fmt(endDate)}`,
    priorLabel: `${priorStartKey} – ${fmt(priorEnd)}`,
  };
  const priceMix = [...decomposed].sort((a, b) => Math.abs(b.revenuePct) - Math.abs(a.revenuePct));

  // Categories ranked by their own period revenue -- the order the channel
  // mix, day mix and concentration views below all read in, largest first.
  const byRevenueDesc = (a, b) => (periodTotals.get(b.category)?.revenue || 0) - (periodTotals.get(a.category)?.revenue || 0);

  // #4 Channel mix per subcategory (this period's totals, one bar per
  // subcategory rather than one bar per week -- the dimension of interest
  // here is the subcategory, not time).
  const channelMix = [...channelTotals.entries()]
    .map(([category, byChannel]) => ({ category, ...byChannel }))
    .sort(byRevenueDesc);

  // #5 Weekday vs Saturday vs Sunday mix per subcategory, same shape.
  const dayMix = [...dayTotals.entries()]
    .map(([category, byDay]) => ({ category, ...byDay }))
    .sort(byRevenueDesc);

  // #6 Within-subcategory concentration: how much of each subcategory's
  // revenue its top 3 items carry -- a evenly-spread subcategory vs. one
  // hero SKU carrying passengers.
  const pareto = [...itemTotals.entries()]
    .map(([category, itemMap]) => {
      const total = [...itemMap.values()].reduce((sum, v) => sum + v, 0);
      const top = [...itemMap.entries()]
        .map(([itemId, revenue]) => ({ name: itemById.get(itemId)?.name || 'Unknown item', revenue }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, PARETO_TOP_N);
      const topShare = total ? top.reduce((sum, r) => sum + r.revenue, 0) / total : null;
      return { category, total, top, topShare };
    })
    .filter(r => r.total > 0)
    .sort(byRevenueDesc);

  return { efficiency, priceMix, movers, channelMix, dayMix, pareto, periodLabel: `${periodStart} – ${periodEnd}` };
}

// Hour-of-day buckets, 5am-5pm -- matches the 12 "Revenue by Hour" /
// "AOV by Hour" / "Customers by Hour" metric names already in
// analytics_metrics exactly, so the new staffing views can look those metrics
// up by label instead of re-deriving hour ranges.
export const HOUR_BUCKET_LABELS = [
  '5am-6am', '6am-7am', '7am-8am', '8am-9am', '9am-10am', '10am-11am',
  '11am-12pm', '12pm-1pm', '1pm-2pm', '2pm-3pm', '3pm-4pm', '4pm-5pm',
];

function hourBucketOf(timeSlot) {
  const hour = parseInt(timeSlot.slice(0, 2), 10);
  const idx = hour - 5;
  return idx >= 0 && idx < HOUR_BUCKET_LABELS.length ? HOUR_BUCKET_LABELS[idx] : null;
}

// schedules.time_slot rows are one 15-minute slot each -- confirmed by
// querying the actual gap between consecutive slots for this org (uniformly
// 15 min), rather than assumed from the roster UI's configurable interval.
const SLOT_HOURS = 0.25;

function sumSeriesOverDates(series, dates) {
  let sum = 0, any = false;
  dates.forEach(d => {
    const v = series?.[d];
    if (v != null) { sum += v; any = true; }
  });
  return any ? sum : null;
}

// Revenue generated per rostered labour-hour, by hour of day -- a single
// ratio rather than two series on separate scales (revenue $ and headcount
// don't share a unit), so it reads as one ranked view of which trading
// hours staffing pays off best. revenueGroups is topline.revenue (already
// loaded at page level) -- only the schedule needs a fresh fetch here.
export async function fetchHourlyStaffing(orgId, asOfDate, period, revenueGroups) {
  if (!orgId || !asOfDate) return [];
  const dates = weekAxis(asOfDate, period);
  const periodStart = dates[0];
  const endDate = new Date(asOfDate + 'T12:00:00Z');
  endDate.setUTCDate(endDate.getUTCDate() + 6);
  const periodEnd = endDate.toISOString().slice(0, 10);

  const schedule = await db.getSchedules(orgId, periodStart, periodEnd);
  const hoursByBucket = new Map(HOUR_BUCKET_LABELS.map(l => [l, 0]));
  Object.keys(schedule).forEach(key => {
    const timeSlot = key.split('|')[2];
    const bucket = hourBucketOf(timeSlot);
    if (bucket) hoursByBucket.set(bucket, hoursByBucket.get(bucket) + SLOT_HOURS);
  });

  return HOUR_BUCKET_LABELS.map(hour => {
    const metric = findMetric(revenueGroups, 'Revenue by Hour', hour);
    const revenue = metric ? sumSeriesOverDates(metric.series, dates) || 0 : 0;
    const labourHours = hoursByBucket.get(hour) || 0;
    return {
      hour,
      revenue,
      labourHours,
      revenuePerLabourHour: labourHours > 0 ? revenue / labourHours : null,
    };
  });
}

const WEEKEND_DAYS = new Set([0, 6]); // Sun=0, Sat=6 (UTC)

// Daily labour% (labour $ / revenue $) vs. daily revenue, one point per
// trading day in the selected window -- the daily-level relationship is
// materially stronger than the weekly-level one (see the earlier chat
// analysis this chart formalizes), so it deserves a real scatter rather
// than the weekly bar/line the rest of the tab uses.
export async function fetchLabourEfficiency(orgId, asOfDate, period) {
  if (!orgId || !asOfDate) return [];
  const dates = weekAxis(asOfDate, period);
  const periodStart = dates[0];
  const endDate = new Date(asOfDate + 'T12:00:00Z');
  endDate.setUTCDate(endDate.getUTCDate() + 6);
  const periodEnd = endDate.toISOString().slice(0, 10);

  const [schedule, staff, dailyRevenue] = await Promise.all([
    db.getSchedules(orgId, periodStart, periodEnd),
    db.getStaff(orgId),
    db.getActualDailyRevenue(orgId, periodStart, periodEnd),
  ]);
  const staffById = new Map(staff.map(s => [s.id, s]));

  const hoursByDateStaff = new Map();
  Object.keys(schedule).forEach(key => {
    const [date, staffId] = key.split('|');
    const k = `${date}|${staffId}`;
    hoursByDateStaff.set(k, (hoursByDateStaff.get(k) || 0) + SLOT_HOURS);
  });

  const costByDate = new Map();
  hoursByDateStaff.forEach((hours, key) => {
    const [date, staffId] = key.split('|');
    const s = staffById.get(staffId);
    if (!s) return;
    const isWeekend = WEEKEND_DAYS.has(new Date(date + 'T12:00:00Z').getUTCDay());
    // db.getStaff() maps snake_case DB columns to hourlyRate/weekendRate.
    const rate = (isWeekend ? s.weekendRate : s.hourlyRate) ?? s.hourlyRate ?? 0;
    costByDate.set(date, (costByDate.get(date) || 0) + hours * rate);
  });

  const allDates = [];
  for (let d = new Date(periodStart + 'T12:00:00Z'); d <= endDate; d.setUTCDate(d.getUTCDate() + 1)) {
    allDates.push(d.toISOString().slice(0, 10));
  }

  return allDates
    .map(date => {
      const revenue = dailyRevenue[date] || 0;
      const labourCost = costByDate.get(date) || 0;
      return { date, revenue, labourCost, labourPct: revenue > 0 ? labourCost / revenue : null };
    })
    // A closed day (no revenue) has no efficiency story to tell.
    .filter(r => r.revenue > 0);
}

// Menu items too rare for a % move (or a margin ratio) to mean anything --
// mirrors MIN_ITEM_MOVER_VOLUME's reasoning, same threshold.
const MIN_MENU_ENG_VOLUME = 20;

// Menu Engineering Matrix, costed from R-Recipe's own recipe data rather
// than a category-level approximation -- popularity (units sold) vs.
// profitability (margin % on the REALIZED average price, revenue/qty, not
// the catalog sell_price, so a discounted/3rd-party mix is reflected) for
// every item with both enough volume and an attached recipe. The cost
// resolver below is ported line-for-line from RecipesApp.jsx's
// useCostResolver so a dish's COGS here always matches what R-Recipe itself
// shows -- it isn't a second, potentially-diverging implementation.
export async function fetchMenuEngineering(orgId, asOfDate, period) {
  if (!orgId || !asOfDate) return { items: [], avgQty: 0, avgMarginPct: 0, coverage: null, periodLabel: '' };
  const dates = weekAxis(asOfDate, period);
  const periodStart = dates[0];
  const endDate = new Date(asOfDate + 'T12:00:00Z');
  endDate.setUTCDate(endDate.getUTCDate() + 6);
  const periodEnd = endDate.toISOString().slice(0, 10);

  const [rows, items, skus, components, componentLines, menuItemLines] = await Promise.all([
    db.getItemSalesByRange(orgId, periodStart, periodEnd),
    db.getProductionItems(orgId),
    db.getStockItems(orgId),
    db.getRecipeComponents(orgId),
    db.getRecipeComponentLines(orgId),
    db.getRecipeMenuItemLines(orgId),
  ]);
  const itemById = new Map(items.map(i => [i.id, i]));

  const skuById = new Map(skus.map(s => [s.id, s]));
  const componentById = new Map(components.map(c => [c.id, c]));
  const linesByComponent = new Map();
  componentLines.forEach(l => {
    if (!linesByComponent.has(l.component_id)) linesByComponent.set(l.component_id, []);
    linesByComponent.get(l.component_id).push(l);
  });
  const costCache = new Map();
  function componentUnitCost(componentId, visiting = new Set()) {
    if (costCache.has(componentId)) return costCache.get(componentId);
    if (visiting.has(componentId)) return null; // circular reference guard
    const component = componentById.get(componentId);
    if (!component) return null;
    visiting.add(componentId);
    const lines = linesByComponent.get(componentId) || [];
    let batchCost = 0, unresolved = false;
    lines.forEach(line => {
      const qty = Number(line.qty) || 0;
      let unitCost = null;
      if (line.stock_item_id) unitCost = skuById.get(line.stock_item_id)?.cost_per_uom ?? null;
      else if (line.sub_component_id) unitCost = componentUnitCost(line.sub_component_id, visiting);
      if (unitCost == null) { unresolved = true; return; }
      batchCost += qty * unitCost;
    });
    visiting.delete(componentId);
    const yieldQty = Number(component.batch_yield) || 0;
    const result = (unresolved || yieldQty <= 0) ? null : batchCost / yieldQty;
    costCache.set(componentId, result);
    return result;
  }
  function lineUnitCost(line) {
    if (line.stock_item_id) return skuById.get(line.stock_item_id)?.cost_per_uom ?? null;
    const subId = line.sub_component_id ?? line.component_id;
    if (subId) return componentUnitCost(subId);
    return null;
  }

  const linesByItem = new Map();
  menuItemLines.forEach(l => {
    if (l.is_packaging) return; // packaging is excluded from COGS the same way MenuRecipesTab excludes it
    if (!linesByItem.has(l.item_id)) linesByItem.set(l.item_id, []);
    linesByItem.get(l.item_id).push(l);
  });
  function itemCogs(itemId) {
    const lines = linesByItem.get(itemId);
    if (!lines || lines.length === 0) return null; // no recipe attached
    let cogs = 0, unresolved = false;
    lines.forEach(l => {
      const c = lineUnitCost(l);
      if (c == null) { unresolved = true; return; }
      cogs += c * (Number(l.qty) || 0);
    });
    return unresolved ? null : cogs;
  }

  const salesByItem = new Map();
  rows.forEach(r => {
    const t = salesByItem.get(r.item_id) || { qty: 0, revenue: 0 };
    t.qty += Number(r.qty) || 0;
    t.revenue += Number(r.revenue) || 0;
    salesByItem.set(r.item_id, t);
  });

  // Recipe coverage across every active menu item (not just the ones with
  // enough sales volume to chart) -- the caveat the matrix ships with.
  let totalActive = 0, coveredActive = 0;
  itemById.forEach(item => {
    if (!item.active) return;
    totalActive++;
    if (itemCogs(item.id) != null) coveredActive++;
  });

  const eligible = [];
  salesByItem.forEach((t, itemId) => {
    if (t.qty < MIN_MENU_ENG_VOLUME) return;
    const item = itemById.get(itemId);
    if (!item) return;
    const cogsPerUnit = itemCogs(itemId);
    if (cogsPerUnit == null) return; // excluded, not guessed at
    const avgPrice = t.revenue / t.qty;
    const marginPerUnit = avgPrice - cogsPerUnit;
    eligible.push({
      name: item.name,
      category: item.category || '',
      qty: t.qty,
      revenue: t.revenue,
      avgPrice,
      cogsPerUnit,
      marginPerUnit,
      marginPct: avgPrice > 0 ? marginPerUnit / avgPrice : null,
      contribution: marginPerUnit * t.qty,
    });
  });

  const avgQty = eligible.length ? eligible.reduce((s, r) => s + r.qty, 0) / eligible.length : 0;
  const withMargin = eligible.filter(r => r.marginPct != null);
  const avgMarginPct = withMargin.length ? withMargin.reduce((s, r) => s + r.marginPct, 0) / withMargin.length : 0;

  eligible.forEach(r => {
    const highPop = r.qty >= avgQty;
    const highMargin = r.marginPct != null && r.marginPct >= avgMarginPct;
    r.quadrant = highPop && highMargin ? 'Star' : highPop ? 'Plow-horse' : highMargin ? 'Puzzle' : 'Dog';
  });

  return {
    items: eligible.sort((a, b) => b.contribution - a.contribution),
    avgQty,
    avgMarginPct,
    coverage: totalActive ? coveredActive / totalActive : null,
    periodLabel: `${periodStart} – ${periodEnd}`,
  };
}

// Scans every headline metric (excluding hour-of-day breakdowns, too
// granular for a weekly digest) for the biggest WoW % swings -- a quick
// "what moved this week" summary for the Overview tab, pure computation
// over data already loaded at page level (revenue+costs+budget groups).
const MOVER_DIGEST_EXCLUDE_SECTIONS = new Set([
  'Revenue by Hour', 'AOV by Hour', 'Customers by Hour', 'Avg. Revenue by Hour',
]);
const MIN_MOVER_DIGEST_BASE = 50; // ignore metrics whose prior value is too small for a % move to mean anything

export function weeklyMoversDigest(groups, asOfDate, n = 6) {
  if (!asOfDate) return [];
  const rows = [];
  groups.forEach(g => {
    if (MOVER_DIGEST_EXCLUDE_SECTIONS.has(g.section)) return;
    g.metrics.forEach(m => {
      const delta = wowDeltaAt(m.series, asOfDate);
      if (delta == null) return;
      const dates = sortedDates(m.series);
      const idx = dates.indexOf(asOfDate);
      const prev = m.series[dates[idx - 1]];
      if (Math.abs(prev) < MIN_MOVER_DIGEST_BASE) return;
      rows.push({
        section: g.section,
        metric: m.metric,
        kind: m.kind,
        value: m.series[asOfDate],
        delta,
        good: deltaGood(delta, m.good),
      });
    });
  });
  return rows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, n);
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
      good: isCostMetric(tab, section, r.metric) ? 'down' : 'up',
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

// A week-start date shifted by a whole number of weeks (negative to go
// back) -- used to find "the equivalent as-of date for the block of weeks
// immediately before this one", so a period-summary tile can compare this
// window's total against the same-length prior window's total.
export function shiftWeeks(asOfDate, weeks) {
  if (!asOfDate) return null;
  const d = new Date(asOfDate + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
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
  if (compact && Math.abs(n) >= 1000000) return `$${(n / 1000000).toFixed(1)}m`;
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
