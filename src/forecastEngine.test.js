import { buildDowAverages, forecastItemsForDate, forecastOptionsFromSettings } from './forecastEngine';

// Two Mondays of history; item "a" sells nothing in-store on the second
// Monday (a trading day, since "b" sold), and sells on two delivery apps.
const history = [
  { item_id: 'a', sale_date: '2026-11-02', channel: 'pos', qty: 4 },
  { item_id: 'b', sale_date: '2026-11-02', channel: 'pos', qty: 1 },
  { item_id: 'b', sale_date: '2026-11-09', channel: 'pos', qty: 9 },
  { item_id: 'a', sale_date: '2026-11-09', channel: 'ubereats', qty: 1 },
  { item_id: 'a', sale_date: '2026-11-09', channel: 'doordash', qty: 2 },
];

function groups(itemId) {
  const buckets = buildDowAverages(history, 0);
  const [f] = forecastItemsForDate([{ id: itemId }], buckets, 1, '2026-11-16', '2026-11-16');
  return Object.fromEntries(f.groupStats.map(g => [g.key, g.avg]));
}

test('a trading day with no sales counts as zero', () => {
  expect(groups('a').instore).toBeCloseTo(2); // (4 + 0) / 2, not 4
});

test('delivery apps on the same day are added, and zeros start at first sale', () => {
  expect(groups('a').thirdparty).toBeCloseTo(3); // 1 + 2 on 11-09; 11-02 is before its first app sale
});

test('settings fall back to 4-week recency, no trend', () => {
  expect(forecastOptionsFromSettings(null)).toMatchObject({ halfLifeWeeks: 4, trend: false, uplift: 1 });
  expect(forecastOptionsFromSettings({ recency_halflife_weeks: 0, trend_enabled: true, channel_uplift_pct: 10 }))
    .toMatchObject({ halfLifeDays: 0, trend: true, uplift: 1.1 });
});
