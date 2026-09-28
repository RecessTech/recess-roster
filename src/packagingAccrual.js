// Computes a real, itemised "Packaging" cost from actual sales, as an
// alternative to the single number on the Budget sheet's Packaging row
// (see sheetsData.js's extractRow('Packaging')) -- which is just someone's
// manual estimate, with no tie to what was actually sold.
//
// Reuses R-Recipe's own packaging model rather than re-deriving it: a menu
// item's packaging is its category's rule (category_packaging_lines) minus
// any per-item exclusions, plus any item-specific extra lines
// (recipe_menu_item_lines with is_packaging=true) -- see
// RecipesApp.jsx's effectivePackagingLines, which this mirrors exactly so
// the two stay in agreement. sales_history.item_id points at the same
// production_items row R-Recipe's packaging rules are keyed to, so no new
// mapping table is needed -- it's a direct join.

export function itemPackagingUnitCost(item, { categoryPackagingLines, packagingExclusions, menuItemLines, stockItemById }) {
  if (!item) return 0;
  const excluded = new Set(
    packagingExclusions.filter(e => e.item_id === item.id).map(e => e.stock_item_id)
  );
  const categoryLines = item.category
    ? categoryPackagingLines.filter(l => l.category === item.category && !excluded.has(l.stock_item_id))
    : [];
  const itemLines = menuItemLines.filter(l => l.item_id === item.id && l.is_packaging);

  let cost = 0;
  for (const line of [...categoryLines, ...itemLines]) {
    const unitCost = stockItemById.get(line.stock_item_id)?.cost_per_uom;
    if (unitCost == null) continue;
    cost += (Number(line.qty) || 0) * unitCost;
  }
  return cost;
}

// The Monday that starts dateStr's ISO week -- matches how every other
// Topline series keys its weeks (see toplineData.js's isoWeekParts), so
// this drops straight into the same chart/table components.
function mondayOf(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  const day = d.getUTCDay() || 7; // Sun (0) -> 7, so Mon is always day 1
  d.setUTCDate(d.getUTCDate() - day + 1);
  return d.toISOString().slice(0, 10);
}

// salesRows: sales_history rows ({ item_id, sale_date, qty, ... }) for
// whatever date range/channels the caller already filtered. Returns a
// weekly series shaped exactly like an analytics_metrics series -- a plain
// { 'YYYY-MM-DD' (Monday): value } map -- so it drops straight into
// toChartRows/valueAt/sumOverWindow/etc alongside every other Topline
// metric with no adapting.
export function weeklyPackagingAccrual(salesRows, { productionItems, categoryPackagingLines, packagingExclusions, menuItemLines, stockItems }) {
  const itemById = new Map(productionItems.map(i => [i.id, i]));
  const stockItemById = new Map(stockItems.map(s => [s.id, s]));

  const unitCostCache = new Map();
  function unitCostFor(itemId) {
    if (unitCostCache.has(itemId)) return unitCostCache.get(itemId);
    const cost = itemPackagingUnitCost(itemById.get(itemId), { categoryPackagingLines, packagingExclusions, menuItemLines, stockItemById });
    unitCostCache.set(itemId, cost);
    return cost;
  }

  const series = {};
  for (const row of salesRows) {
    const week = mondayOf(row.sale_date);
    const cost = (Number(row.qty) || 0) * unitCostFor(row.item_id);
    series[week] = (series[week] || 0) + cost;
  }
  return series;
}
