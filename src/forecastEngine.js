// ── Crystal Ball forecasting engine ─────────────────────────────────────────
// Shared by CrystalBallApp (the Forecast tab) and ProductionApp (R-Prod's
// "Pull from Crystal Ball" button) so both read the exact same numbers for
// the exact same item/date -- one algorithm, not two copies that can drift.

// Each sales channel is forecast independently (its own day-of-week average),
// then the channels are ADDED together -- in-store customers, 3rd-party-app
// customers, and B2B customers are different people ordering on top of each
// other, not samples of the same demand to be blended into one average.
export const CHANNEL_GROUPS = [
  { key: 'instore', label: 'In-Store', channels: ['pos'] },
  { key: 'thirdparty', label: '3rd Party Apps', channels: ['ubereats', 'doordash', 'classpass', 'heyyou'] },
  { key: 'b2b', label: 'B2B', channels: ['catering', 'vending', 'wholesale'] },
];
export const CHANNEL_TO_GROUP = new Map(
  CHANNEL_GROUPS.flatMap(g => g.channels.map(ch => [ch, g.key]))
);

export function dayOfWeekIndex(dateStr) { return new Date(dateStr + 'T12:00:00').getDay(); } // 0=Sun..6=Sat

// A bucket needs at least this many historical same-weekday data points
// before a trend line is trusted at all -- below this, too few points
// makes a "slope" meaningless noise, so it's forced flat.
const MIN_TREND_SAMPLES = 4;

// However strong the fitted trend looks, its contribution this many
// weeks out is capped to +-50% of the current level -- a couple of
// unusually large recent weeks shouldn't be able to extrapolate a
// forecast to zero or to some absurd multiple several weeks out.
const MAX_TREND_DELTA_FRACTION = 0.5;

// Weighted least squares over a bucket's (weeksFromNow, qty) points --
// weeksFromNow is negative for past sales, 0 = today -- returning the
// fitted value at the requested weeksFromNow. With < MIN_TREND_SAMPLES
// points, or with all points landing in the same week (no x variance
// to fit a slope against), this degrades to the flat recency-weighted
// mean (slope forced to 0), same as before trend support existed.
// Trend is OFF by default (crystal_ball_settings.trend_enabled): a line
// fitted per item x weekday added more noise than signal in backtests.
export function bucketPredict(bucket, weeksFromNow, { trend = DEFAULT_TREND_ENABLED } = {}) {
  if (!bucket) return { value: 0, samples: 0 };
  const [rawCount, sw, swx, swy, swxx, swxy] = bucket;
  if (sw <= 0) return { value: 0, samples: rawCount };
  const xbar = swx / sw;
  const ybar = swy / sw;
  const sxx = swxx - sw * xbar * xbar;
  const slope = (trend && rawCount >= MIN_TREND_SAMPLES && sxx > 1e-6)
    ? (swxy - sw * xbar * ybar) / sxx
    : 0;
  const intercept = ybar - slope * xbar; // fitted value at weeksFromNow = 0 (today)
  const trendDelta = slope * weeksFromNow;
  const cap = Math.abs(intercept) * MAX_TREND_DELTA_FRACTION;
  const clampedDelta = Math.max(-cap, Math.min(cap, trendDelta));
  return { value: Math.max(0, intercept + clampedDelta), samples: rawCount };
}

// Defaults used when crystal_ball_settings has no value (or the column
// doesn't exist yet). A 4-week half-life with no per-item trend line was
// the most accurate setup when backtested on Sep--Nov 2026 sales.
export const DEFAULT_RECENCY_HALFLIFE_WEEKS = 4;
export const DEFAULT_TREND_ENABLED = false;

// Turns a crystal_ball_settings row (possibly null, possibly missing
// columns) into the options every caller passes to the engine, so the
// Forecast tab, Week Ahead and R-Prod's pull button can't drift apart.
export function forecastOptionsFromSettings(settings) {
  const hl = settings?.recency_halflife_weeks;
  const halfLifeWeeks = hl === null || hl === undefined || hl === '' || isNaN(Number(hl))
    ? DEFAULT_RECENCY_HALFLIFE_WEEKS
    : Math.max(0, Number(hl));
  const trend = typeof settings?.trend_enabled === 'boolean' ? settings.trend_enabled : DEFAULT_TREND_ENABLED;
  const uplift = 1 + (Number(settings?.channel_uplift_pct) || 0) / 100;
  return { halfLifeWeeks, halfLifeDays: halfLifeWeeks * 7, trend, uplift };
}

// Historical day-of-week average qty, per item, PER CHANNEL GROUP -- keeping
// groups separate (rather than one bucket per item) is what lets them be
// added together instead of diluting each other into one blended avg.
//
// One data point per TRADING DAY, not per sales row:
// - rows for the same item/date/group (e.g. UberEats + DoorDash + ClassPass)
//   are summed into that day's total first, not averaged as separate points;
// - a trading day (any date with any sales at all) on which the item sold
//   nothing in that group counts as 0. Skipping those days made slow items
//   look 25-55% busier than they were. Zeros only count from the first
//   date the item sold in that group, so a newly launched item (or a newly
//   added delivery app) isn't dragged down by days before it existed.
//   Days the shop was closed have no sales rows at all, so they're never
//   counted as zeros.
//
// Recency-weighted: a sale one half-life ago counts half as much as one
// from today, two half-lives ago a quarter, etc. -- 0 = flat average.
// Each bucket accumulates the weighted sums a weighted-least-squares trend
// line needs (qty vs. weeksFromNow, weeksFromNow=0 is today, negative for
// past sales); bucketPredict() uses them for the level, and for a trend
// line only when the caller turns trend on.
export function buildDowAverages(salesHistory, halfLifeDays) {
  const dayTotals = new Map();   // `${itemId}|${groupKey}` -> Map(date -> qty)
  const tradingDates = new Set();
  salesHistory.forEach(row => {
    if (!row || !row.sale_date || !row.item_id) return;
    tradingDates.add(row.sale_date);
    const groupKey = CHANNEL_TO_GROUP.get(row.channel) || 'instore';
    const key = `${row.item_id}|${groupKey}`;
    let byDate = dayTotals.get(key);
    if (!byDate) { byDate = new Map(); dayTotals.set(key, byDate); }
    byDate.set(row.sale_date, (byDate.get(row.sale_date) || 0) + (Number(row.qty) || 0));
  });
  const sortedDates = [...tradingDates].sort();

  const buckets = new Map(); // `${itemId}:${dow}:${groupKey}` -> [rawCount, sw, swx, swy, swxx, swxy]
  const now = Date.now();
  dayTotals.forEach((byDate, key) => {
    const [itemId, groupKey] = key.split('|');
    let firstDate = null;
    byDate.forEach((qty, d) => { if (firstDate === null || d < firstDate) firstDate = d; });
    for (const d of sortedDates) {
      if (d < firstDate) continue;
      const y = byDate.get(d) || 0;
      const dow = dayOfWeekIndex(d);
      const bKey = `${itemId}:${dow}:${groupKey}`;
      const daysAgo = Math.max(0, (now - new Date(d + 'T12:00:00').getTime()) / 86400000);
      const weight = halfLifeDays > 0 ? Math.pow(0.5, daysAgo / halfLifeDays) : 1;
      const x = -daysAgo / 7;
      const entry = buckets.get(bKey) || [0, 0, 0, 0, 0, 0];
      entry[0] += 1;
      entry[1] += weight;
      entry[2] += weight * x;
      entry[3] += weight * y;
      entry[4] += weight * x * x;
      entry[5] += weight * x * y;
      buckets.set(bKey, entry);
    }
  });
  return buckets;
}

// Same math the single-day Forecast tab uses, factored out so any caller
// (the weekly rollup, R-Prod's pull-in button) gets identical forecasts to
// what Crystal Ball itself shows for that item on that date. `todayDateStr`
// is the caller's own local-timezone "today" (e.g. its todayStr()) -- kept
// as a parameter rather than computed here so this never drifts from the
// UTC date near local midnight.
export function forecastItemsForDate(items, dowAverages, uplift, dateStr, todayDateStr, { trend = DEFAULT_TREND_ENABLED } = {}) {
  const dow = dayOfWeekIndex(dateStr);
  const weeksFromNow = (new Date(dateStr + 'T12:00:00').getTime() - new Date(todayDateStr + 'T12:00:00').getTime()) / (7 * 86400000);
  return items.map(item => {
    const groupStats = CHANNEL_GROUPS.map(g => {
      const bucket = dowAverages.get(`${item.id}:${dow}:${g.key}`);
      const { value: avg, samples } = bucketPredict(bucket, weeksFromNow, { trend });
      return { ...g, avg, samples };
    });
    const baseTotal = groupStats.reduce((s, g) => s + g.avg, 0);
    const forecast = baseTotal * uplift;
    const samples = groupStats.reduce((s, g) => s + g.samples, 0);
    return { item, groupStats, forecast, samples };
  }).filter(f => f.forecast > 0 || f.samples > 0);
}
