import Papa from 'papaparse';

const SPREADSHEET_ID = '1swskNwfkmVrlT1HNeOzq9VovBipxtuhxA8mPze1DEhY';

const SHEET_GIDS = {
  revenue: 1981032383,
  costs: 913347837,
  customer: 332006994,
};

function buildCsvUrl(gid) {
  return `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=${gid}`;
}

async function fetchSheetCsv(gid) {
  const url = buildCsvUrl(gid);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch sheet (gid=${gid}): ${res.status}`);
  const text = await res.text();
  const { data } = Papa.parse(text, { header: false, skipEmptyLines: true });
  return data;
}

// Parse a value like "$6,677" or "423%" or "68.70%" into a number
function parseNum(val) {
  if (!val || val === '' || val === '-') return null;
  const cleaned = val.replace(/[$,%\s]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

// Find the row index whose first cell matches (case-insensitive, partial match)
function findRow(data, label) {
  return data.findIndex(row =>
    row[0] && row[0].toLowerCase().includes(label.toLowerCase())
  );
}

// Extract a metric row: returns array of {period, value} from columns 1..N
function extractMetricRow(data, label, headerRow) {
  const idx = findRow(data, label);
  if (idx === -1) return [];
  const row = data[idx];
  const headers = data[headerRow] || [];
  const result = [];
  for (let i = 1; i < row.length; i++) {
    const val = parseNum(row[i]);
    if (val !== null) {
      result.push({ period: headers[i] || `Col${i}`, value: val });
    }
  }
  return result;
}

export async function fetchRevenueData() {
  const data = await fetchSheetCsv(SHEET_GIDS.revenue);

  // Row 0 is typically the header row with period labels
  const headerIdx = 0;
  const headers = data[headerIdx] || [];

  // Build period labels from header row (skip first column which is the metric name)
  const periods = headers.slice(1).filter(h => h && h.trim() !== '');

  // Helper to extract a named row
  const getRow = (label) => extractMetricRow(data, label, headerIdx);

  return {
    periods,
    totalRevenue: getRow('Total Revenue'),
    inStoreRevenue: getRow('In-Store'),
    uberEatsRevenue: getRow('UberEats'),
    cateringRevenue: getRow('Catering'),
    aov: getRow('AOV'),
    avgDailyCustomers: getRow('Avg. Daily Customers'),
    avgDailyRevenue: getRow('Avg. Daily Rev'),
    avgWeeklyRevenue: getRow('Avg. Weekly Revenue'),
    foodPct: getRow('Food %'),
    drinksPct: getRow('Drinks %'),
    raw: data,
  };
}

export async function fetchCostsData() {
  const data = await fetchSheetCsv(SHEET_GIDS.costs);
  const headerIdx = 0;

  const getRow = (label) => extractMetricRow(data, label, headerIdx);

  return {
    foodbyus: getRow('Foodbyus'),
    ordermentum: getRow('Ordermentum'),
    supermarket: getRow('Supermarket'),
    directSupply: getRow('Direct Supply'),
    totalCogs: getRow('Total COGS'),
    unitsSold: getRow('Units Sold'),
    cogsPerUnit: getRow('Avg. COGS per Unit'),
    cogsPctRevenue: getRow('COGS % of Revenue'),
    totalLabour: getRow('Total Labour'),
    labourPctRevenue: getRow('Labour % of Revenue'),
    raw: data,
  };
}

export async function fetchCustomerData() {
  const data = await fetchSheetCsv(SHEET_GIDS.customer);
  const headerIdx = 0;

  const getRow = (label) => extractMetricRow(data, label, headerIdx);

  return {
    instagramFollowers: getRow('Instagram'),
    tiktokFollowers: getRow('TikTok'),
    loyaltyMembers: getRow('Loyalty'),
    googleReviews: getRow('Google Review'),
    googleRating: getRow('Average Google'),
    raw: data,
  };
}

export async function fetchAllData() {
  const [revenue, costs, customer] = await Promise.all([
    fetchRevenueData(),
    fetchCostsData(),
    fetchCustomerData(),
  ]);
  return { revenue, costs, customer };
}
