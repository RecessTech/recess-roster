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
export function bucketPredict(bucket, weeksFromNow) {
  if (!bucket) return { value: 0, samples: 0 };
  const [rawCount, sw, swx, swy, swxx, swxy] = bucket;
  if (sw <= 0) return { value: 0, samples: rawCount };
  const xbar = swx / sw;
  const ybar = swy / sw;
  const sxx = swxx - sw * xbar * xbar;
  const slope = (rawCount >= MIN_TREND_SAMPLES && sxx > 1e-6)
    ? (swxy - sw * xbar * ybar) / sxx
    : 0;
  const intercept = ybar - slope * xbar; // fitted value at weeksFromNow = 0 (today)
  const trendDelta = slope * weeksFromNow;
  const cap = Math.abs(intercept) * MAX_TREND_DELTA_FRACTION;
  const clampedDelta = Math.max(-cap, Math.min(cap, trendDelta));
  return { value: Math.max(0, intercept + clampedDelta), samples: rawCount };
}

// Historical day-of-week average qty, per item, PER CHANNEL GROUP -- keeping
// groups separate (rather than one bucket per item) is what lets them be
// added together instead of diluting each other into one blended avg.
//
// Recency-weighted: a sale one half-life ago counts half as much as one
// from today, two half-lives ago a quarter, etc. -- 0 = old flat-average
// behaviour. Each bucket accumulates the weighted sums a weighted-least-
// squares trend line needs (qty vs. weeksFromNow, weeksFromNow=0 is today,
// negative for past sales) rather than just a mean -- bucketPredict() fits
// and extrapolates from these, degrading to a flat recency-weighted average
// when there isn't enough data to trust a slope.
export function buildDowAverages(salesHistory, halfLifeDays) {
  const buckets = new Map(); // `${itemId}:${dow}:${groupKey}` -> [rawCount, sw, swx, swy, swxx, swxy]
  const now = Date.now();
  salesHistory.forEach(row => {
    const groupKey = CHANNEL_TO_GROUP.get(row.channel) || 'instore';
    const dow = dayOfWeekIndex(row.sale_date);
    const key = `${row.item_id}:${dow}:${groupKey}`;
    const daysAgo = Math.max(0, (now - new Date(row.sale_date + 'T12:00:00').getTime()) / 86400000);
    const weight = halfLifeDays > 0 ? Math.pow(0.5, daysAgo / halfLifeDays) : 1;
    const x = -daysAgo / 7;
    const y = Number(row.qty) || 0;
    const entry = buckets.get(key) || [0, 0, 0, 0, 0, 0];
    entry[0] += 1;
    entry[1] += weight;
    entry[2] += weight * x;
    entry[3] += weight * y;
    entry[4] += weight * x * x;
    entry[5] += weight * x * y;
    buckets.set(key, entry);
  });
  return buckets;
}

// Same math the single-day Forecast tab uses, factored out so any caller
// (the weekly rollup, R-Prod's pull-in button) gets identical forecasts to
// what Crystal Ball itself shows for that item on that date. `todayDateStr`
// is the caller's own local-timezone "today" (e.g. its todayStr()) -- kept
// as a parameter rather than computed here so this never drifts from the
// UTC date near local midnight.
export function forecastItemsForDate(items, dowAverages, uplift, dateStr, todayDateStr) {
  const dow = dayOfWeekIndex(dateStr);
  const weeksFromNow = (new Date(dateStr + 'T12:00:00').getTime() - new Date(todayDateStr + 'T12:00:00').getTime()) / (7 * 86400000);
  return items.map(item => {
    const groupStats = CHANNEL_GROUPS.map(g => {
      const bucket = dowAverages.get(`${item.id}:${dow}:${g.key}`);
      const { value: avg, samples } = bucketPredict(bucket, weeksFromNow);
      return { ...g, avg, samples };
    });
    const baseTotal = groupStats.reduce((s, g) => s + g.avg, 0);
    const forecast = baseTotal * uplift;
    const samples = groupStats.reduce((s, g) => s + g.samples, 0);
    return { item, groupStats, forecast, samples };
  }).filter(f => f.forecast > 0 || f.samples > 0);
}
