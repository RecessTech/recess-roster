import Papa from 'papaparse';

const SPREADSHEET_ID = '1swskNwfkmVrlT1HNeOzq9VovBipxtuhxA8mPze1DEhY';

const SHEET_GIDS = {
  revenue: 1981032383,
  costs: 913347837,
  customer: 332006994,
  packagingData: 1126682496,
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

// Parse " $ 6,677 " or "423%" or "68.70%" or "$ (287)" (negative) into a number
function parseNum(val) {
  if (!val || val.trim() === '' || val.trim() === '-' || val.trim() === '$ -') return null;
  // Handle parenthetical negatives like "$ (287)"
  const isNeg = val.includes('(') && val.includes(')');
  const cleaned = val.replace(/[$,%\s()]/g, '');
  if (cleaned === '' || cleaned === '-') return null;
  const n = parseFloat(cleaned);
  if (isNaN(n)) return null;
  return isNeg ? -n : n;
}

// Find a row by EXACT trimmed match on column A
function findRowExact(data, label) {
  return data.findIndex(row =>
    row[0] && row[0].trim() === label.trim()
  );
}

// Extract a metric row by exact label match.
// Returns array of {period, value} from columns 1..N, skipping CLOSED weeks and nulls.
function extractMetricRow(data, label, headerRow) {
  const idx = findRowExact(data, label);
  if (idx === -1) return [];
  const row = data[idx];
  const headers = data[headerRow] || [];
  const result = [];
  for (let i = 1; i < row.length; i++) {
    const period = (headers[i] || '').trim();
    // Skip CLOSED periods
    if (period.startsWith('CLOSED')) continue;
    const val = parseNum(row[i]);
    if (val !== null) {
      result.push({ period, value: val });
    }
  }
  return result;
}

// Parse period string like "Q1-2024 M03 W12" into structured object
export function parsePeriod(period) {
  // Revenue format: "Q1-2024 M03 W12"
  let match = period.match(/Q(\d)-(\d{4})\s+M(\d{2})\s+W(\d{1,2})/);
  if (match) {
    return { quarter: parseInt(match[1]), year: parseInt(match[2]), month: parseInt(match[3]), week: parseInt(match[4]) };
  }
  // Costs format: "Q1-2024 W12"
  match = period.match(/Q(\d)-(\d{4})\s+W(\d{1,2})/);
  if (match) {
    return { quarter: parseInt(match[1]), year: parseInt(match[2]), week: parseInt(match[3]) };
  }
  // Customer format: just "W12"
  match = period.match(/^W(\d{1,2})$/);
  if (match) {
    return { week: parseInt(match[1]) };
  }
  return null;
}

export async function fetchRevenueData() {
  const data = await fetchSheetCsv(SHEET_GIDS.revenue);
  const headerIdx = 0;
  const getRow = (label) => extractMetricRow(data, label, headerIdx);

  return {
    totalRevenue: getRow('Revenue - Total'),
    inStoreRevenue: getRow('Revenue - In-Store'),
    uberEatsRevenue: getRow('Revenue - UberEats & DoorDash'),
    cateringRevenue: getRow('Revenue - Catering / B2B'),
    classpassRevenue: getRow('Revenue - Classpass / TGTG'),
    avgDailyRevenue: getRow('Avg. In-Store Daily Rev.'),
    avgRevenuePerHour: getRow('Avg. Revenue Per Hour'),
    customers: getRow('Customers'),
    aov: getRow('AOV'),
    avgDailyCustomers: getRow('Avg. Daily Customers'),
    tradingHours: getRow('Trading Hours'),
    foodPct: getRow('Food Share of Rev. %'),
    drinksPct: getRow('Drinks Share of Rev. %'),
    snacksPct: getRow('Snacks Share of Rev. %'),
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
    totalCogs: getRow('Total'),
    unitsSold: getRow('Units Sold'),
    cogsPerUnit: getRow('Average COGS per Unit'),
    cogsPctRevenue: getRow('COGS % of Revenue'),
    totalLabour: getRow('Total Labour Cost'),
    labourPctRevenue: getRow('Labour % Of Revenue'),
    raw: data,
  };
}

export async function fetchCustomerData() {
  const data = await fetchSheetCsv(SHEET_GIDS.customer);
  const headerIdx = 0;
  const getRow = (label) => extractMetricRow(data, label, headerIdx);

  return {
    instagramFollowers: getRow('Instagram Followers'),
    facebookLikes: getRow('Facebook Page Likes'),
    tiktokFollowers: getRow('TikTok Followers'),
    loyaltyMembers: getRow('Loyalty Members'),
    googleReviews: getRow('Google Reviews'),
    googleRating: getRow('Average Google Rating'),
    raw: data,
  };
}

// Parse packaging consumption from PCK Data sheet.
// Each row is a menu item / modifier with quantity sold and PCK1-PCK4 codes.
// Returns { consumption: { skuCode: { total, items } }, menuItems: [] }
export async function fetchPackagingData() {
  const data = await fetchSheetCsv(SHEET_GIDS.packagingData);
  if (!data || data.length < 2) return { consumption: {}, menuItems: [] };

  const header = data[0].map(h => (h || '').trim().toLowerCase());
  const colQty      = header.findIndex(h => h === 'quantity');
  const colItemName = header.findIndex(h => h === 'item name');
  const colModifier = header.findIndex(h => h === 'modifier');
  // PCK columns (case-insensitive, PCK1..PCK4)
  const colPck = [1, 2, 3, 4].map(n =>
    data[0].findIndex(h => (h || '').trim().toUpperCase() === `PCK${n}`)
  );

  const consumption = {}; // { skuCode: { total: number, items: [{label, qty}] } }
  const menuItems = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rawQty = colQty >= 0 ? (row[colQty] || '').toString().replace(/,/g, '').trim() : '';
    const qty = parseFloat(rawQty);
    if (!qty || qty <= 0) continue;

    const pckCodes = colPck
      .filter(ci => ci >= 0)
      .map(ci => (row[ci] || '').trim())
      .filter(v => v !== '');

    if (pckCodes.length === 0) continue;

    const itemName = colItemName >= 0 ? (row[colItemName] || '').trim() : '';
    const modifier  = colModifier >= 0 ? (row[colModifier] || '').trim() : '';
    const label = modifier ? `${itemName} (${modifier})` : itemName;

    menuItems.push({ label, qty, pckCodes });

    for (const code of pckCodes) {
      if (!consumption[code]) consumption[code] = { total: 0, items: [] };
      consumption[code].total += qty;
      consumption[code].items.push({ label, qty });
    }
  }

  return { consumption, menuItems };
}

export async function fetchAllData() {
  const [revenue, costs, customer] = await Promise.all([
    fetchRevenueData(),
    fetchCostsData(),
    fetchCustomerData(),
  ]);
  return { revenue, costs, customer };
}
