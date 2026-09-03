-- Fetta: $9.83/kg -> $12.96/kg (Bidfood, Cheese Fetta Danish, Casa De Ma 2kg @ $25.92)
UPDATE stock_items SET pack_size = 2000, pack_cost = 25.92 WHERE sku = 'SKU-0098';

-- Chicken Breast: $11.17/kg -> $24.00/kg (Farmer Joe's, Tenderloin Small Excess, 8.2kg @ $24.00/kg)
UPDATE stock_items SET pack_size = 1000, pack_cost = 24.00 WHERE sku = 'SKU-0090';

SELECT name, sku, uom, pack_size, pack_cost, cost_per_uom
FROM stock_items
WHERE sku IN ('SKU-0098', 'SKU-0090');
