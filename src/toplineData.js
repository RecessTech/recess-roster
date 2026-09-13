// R-Topline's native data layer -- replaces the old sheetsData.js (which
// pulled live from the Analytics Hub Google Sheet) for this module only.
// PackagingApp.jsx still uses sheetsData.js/fetchPackagingData directly;
// that's a separate, untouched concern.
import { db } from './supabaseClient';

// ── Period labelling ─────────────────────────────────────────────────────────
// Mirrors the legacy sheet's own convention (kept so existing chart/filter
// code in ToplineApp.jsx -- which parses these strings -- keeps working):
// quarters are Q1:W01-13, Q2:W14-26, Q3:W27-40, Q4:W41-52; week is a plain
// count of weeks since Jan 1 of that calendar year, not an ISO week number.

function quarterOfWeek(weekNum) {
  return weekNum <= 13 ? 1 : weekNum <= 26 ? 2 : weekNum <= 40 ? 3 : 4;
}
function weekOfYear(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const jan1 = new Date(d.getFullYear(), 0, 1);
  return Math.max(1, Math.floor((d - jan1) / (7 * 86400000)) + 1);
}
function periodLabels(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const week = weekOfYear(dateStr);
  const quarter = quarterOfWeek(week);
  const w = String(week).padStart(2, '0');
  const m = String(month).padStart(2, '0');
  return {
    revenue: `Q${quarter}-${year} M${m} W${w}`,
    short: `Q${quarter}-${year} W${w}`,
  };
}

export function parsePeriod(period) {
  let match = period.match(/Q(\d)-(\d{4})\s+M(\d{2})\s+W(\d{1,2})/);
  if (match) return { quarter: parseInt(match[1]), year: parseInt(match[2]), month: parseInt(match[3]), week: parseInt(match[4]) };
  match = period.match(/Q(\d)-(\d{4})\s+W(\d{1,2})/);
  if (match) return { quarter: parseInt(match[1]), year: parseInt(match[2]), week: parseInt(match[3]) };
  match = period.match(/^W(\d{1,2})$/);
  if (match) return { week: parseInt(match[1]) };
  return null;
}

const EARLIEST_DATE = '2024-01-01';
function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Revenue ──────────────────────────────────────────────────────────────────

export async function fetchRevenueData(orgId) {
  const weekly = await db.getWeeklyRevenue(orgId, EARLIEST_DATE, todayIso());
  const series = (get, labelKind = 'revenue') => weekly
    .map(w => ({ period: periodLabels(w.week_start_date)[labelKind], value: get(w) }))
    .filter(r => r.value != null && !isNaN(r.value));

  return {
    totalRevenue: series(w => w.total),
    inStoreRevenue: series(w => w.food + w.drinks + w.snacks),
    uberEatsRevenue: series(w => w.thirdparty),
    cateringRevenue: series(w => w.catering + w.wholesale),
    classpassRevenue: series(w => w.classpass),
    vendingRevenue: series(w => w.vending),
    foodPct: series(w => (w.total > 0 ? (100 * w.food) / w.total : null)),
    drinksPct: series(w => (w.total > 0 ? (100 * w.drinks) / w.total : null)),
    snacksPct: series(w => (w.total > 0 ? (100 * w.snacks) / w.total : null)),
    // Not derivable from item-level sales_history -- there's no per-order /
    // covers count anywhere in R-Shift yet, only item lines. Left empty
    // rather than guessed; charts/cards for these render as "no data".
    avgDailyRevenue: [],
    avgRevenuePerHour: [],
    customers: [],
    aov: [],
    avgDailyCustomers: [],
    tradingHours: [],
    raw: weekly,
  };
}

// ── Costs (from R-Topline's pnl_entries, not a per-supplier breakdown --
// COGS is tracked as one manual figure now, not split by supplier) ─────────

export async function fetchCostsData(orgId) {
  const budget = await fetchBudgetData(orgId);
  return {
    // Supplier-level COGS split (Foodbyus/Ordermentum/etc.) isn't tracked
    // going forward -- COGS is entered as a single manual weekly figure.
    foodbyus: [],
    ordermentum: [],
    supermarket: [],
    directSupply: [],
    totalCogs: budget.cogs,
    unitsSold: [],
    cogsPerUnit: [],
    cogsPctRevenue: budget.cogsPct,
    totalLabour: budget.totalLabour,
    labourPctRevenue: budget.labourPct,
    grossProfit: budget.pc1Margin,
    operatingExpenses: [],
    ebitda: [],
    netProfit: budget.operatingProfit,
    raw: budget.raw,
  };
}

// ── P&L (the [EXPORT] Budget replacement) ───────────────────────────────────

const REVENUE_LINE_NAMES = new Set([
  'Food Gross Revenue', 'Drinks Gross Revenue', 'Snacks Gross Revenue',
  '3rd Party Apps Gross Revenue', 'Classpass Revenue',
  'Catering Gross Revenue', 'Vending Revenue', 'Wholesale Gross Revenue',
]);

export async function fetchBudgetData(orgId) {
  const startDate = EARLIEST_DATE;
  const endDate = todayIso();

  const [lineItems, entries, recurring, weeklyRevenue, weeklyLabour] = await Promise.all([
    db.getPnlLineItems(orgId),
    db.getPnlEntries(orgId, startDate, endDate),
    db.getPnlRecurringCosts(orgId),
    db.getWeeklyRevenue(orgId, startDate, endDate),
    db.getWeeklyLabourCost(orgId, startDate, endDate),
  ]);

  const weeks = [...new Set([
    ...weeklyRevenue.map(w => w.week_start_date),
    ...weeklyLabour.map(w => w.week_start_date),
    ...entries.map(e => e.week_start_date),
  ])].sort();

  const revenueByWeek = new Map(weeklyRevenue.map(w => [w.week_start_date, w]));
  const labourByWeek = new Map(weeklyLabour.map(w => [w.week_start_date, w]));
  const entryByKey = new Map(entries.map(e => [`${e.line_item_id}:${e.week_start_date}`, Number(e.amount) || 0]));
  const recurringByItem = new Map();
  recurring.forEach(r => {
    if (!recurringByItem.has(r.line_item_id)) recurringByItem.set(r.line_item_id, []);
    recurringByItem.get(r.line_item_id).push(r);
  });

  function recurringAmountFor(lineItemId, weekStart) {
    const rows = recurringByItem.get(lineItemId) || [];
    const active = rows.find(r => r.starts_on <= weekStart && (!r.ends_on || r.ends_on >= weekStart));
    return active ? Number(active.amount) || 0 : null;
  }

  function amountFor(item, weekStart) {
    if (item.name === 'Food Gross Revenue') return revenueByWeek.get(weekStart)?.food || 0;
    if (item.name === 'Drinks Gross Revenue') return revenueByWeek.get(weekStart)?.drinks || 0;
    if (item.name === 'Snacks Gross Revenue') return revenueByWeek.get(weekStart)?.snacks || 0;
    if (item.name === '3rd Party Apps Gross Revenue') return revenueByWeek.get(weekStart)?.thirdparty || 0;
    if (item.name === 'Classpass Revenue') return revenueByWeek.get(weekStart)?.classpass || 0;
    if (item.name === 'Catering Gross Revenue') return revenueByWeek.get(weekStart)?.catering || 0;
    if (item.name === 'Vending Revenue') return revenueByWeek.get(weekStart)?.vending || 0;
    if (item.name === 'Wholesale Gross Revenue') return revenueByWeek.get(weekStart)?.wholesale || 0;
    if (item.name === 'Wages') return labourByWeek.get(weekStart)?.wages || 0;
    if (item.name === 'Superannuation') return labourByWeek.get(weekStart)?.superannuation || 0;
    const explicit = entryByKey.get(`${item.id}:${weekStart}`);
    if (explicit != null) return explicit;
    if (item.source === 'recurring') return recurringAmountFor(item.id, weekStart) || 0;
    return 0;
  }

  const byName = (name) => weeks.map(weekStart => {
    const item = lineItems.find(li => li.name === name);
    return { period: periodLabels(weekStart).short, value: item ? amountFor(item, weekStart) : null };
  }).filter(r => r.value != null);

  const grossRevenue = weeks.map(weekStart => {
    const total = lineItems.filter(li => REVENUE_LINE_NAMES.has(li.name)).reduce((s, li) => s + amountFor(li, weekStart), 0);
    return { period: periodLabels(weekStart).short, value: total };
  });

  const cogsSeries = byName('COGS');
  const packagingSeries = byName('Packaging');
  const wastesSeries = byName('COGS Waste');
  const pc1Total = weeks.map((weekStart, i) => ({
    period: periodLabels(weekStart).short,
    value: (cogsSeries[i]?.value || 0) + (packagingSeries[i]?.value || 0) + (wastesSeries[i]?.value || 0),
  }));

  const labourWages = byName('Wages');
  const superannuation = byName('Superannuation');
  const totalLabour = weeks.map((weekStart, i) => ({
    period: periodLabels(weekStart).short,
    value: (labourWages[i]?.value || 0) + (superannuation[i]?.value || 0),
  }));

  const netRevenue = grossRevenue; // fees/discounts aren't wired to auto-deduct yet
  const pc1Margin = netRevenue.map((r, i) => ({ period: r.period, value: r.value - (pc1Total[i]?.value || 0) }));
  const operatingProfit = pc1Margin.map((r, i) => ({ period: r.period, value: r.value - (totalLabour[i]?.value || 0) }));
  const cogsPct = grossRevenue.map((r, i) => ({ period: r.period, value: r.value > 0 ? (100 * (pc1Total[i]?.value || 0)) / r.value : null })).filter(r => r.value != null);
  const labourPct = grossRevenue.map((r, i) => ({ period: r.period, value: r.value > 0 ? (100 * (totalLabour[i]?.value || 0)) / r.value : null })).filter(r => r.value != null);

  return {
    lineItems, entries, recurring,
    grossRevenue, netRevenue, cogs: cogsSeries, packaging: packagingSeries,
    pc1Total, pc1Margin, cogsPct, labourPct,
    labourWages, superannuation, totalLabour, operatingProfit,
    raw: { lineItems, entries },
  };
}

// ── Customer (not tracked -- hidden tab, kept as a stub so nothing crashes
// if it's ever re-enabled) ──────────────────────────────────────────────────

export async function fetchCustomerData() {
  return {
    instagramFollowers: [], facebookLikes: [], tiktokFollowers: [], loyaltyMembers: [],
    googleReviews: [], googleRating: [], raw: [],
  };
}

export async function fetchAllData(orgId) {
  const [revenue, costs, customer, budget] = await Promise.all([
    fetchRevenueData(orgId),
    fetchCostsData(orgId),
    fetchCustomerData(),
    fetchBudgetData(orgId),
  ]);
  return { revenue, costs, customer, budget };
}
