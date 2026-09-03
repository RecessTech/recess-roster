-- ============================================================
-- R-Stock: SKU price refresh from supplier invoices/orders
-- (Bidfood I71389131, Bidfood I71408522, FoodByUs NSW-2630651,
--  FoodByUs NSW-2630664 -- confident 1:1 matches only)
-- ============================================================
-- These are the items where the invoice/order line is clearly the
-- same real-world product as the existing catalog SKU (same or
-- equivalent pack, no ambiguity about brand/form). Ambiguous ones
-- (Sundried Tomato, Tomato Relish/Chutney, Coca-Cola variants, and
-- brand-new products not yet in the catalog) are intentionally left
-- out -- see the separate list for those.

-- Roast Beef: $25.95/kg -> $26.95/kg (FoodByUs NSW-2630664, Rare Roast Beef Sliced BEE025)
UPDATE stock_items SET pack_size = 1000, pack_cost = 26.95
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Roast Beef';

-- Pastrami: $24.95/kg -> $25.95/kg (FoodByUs NSW-2630664, Pastrami Sliced BEE007)
UPDATE stock_items SET pack_size = 1000, pack_cost = 25.95
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Pastrami';

-- Butter: $17.73/kg -> $17.00/kg (FoodByUs NSW-2630651, Butter Salted 1KG Devondale)
UPDATE stock_items SET pack_size = 1000, pack_cost = 17.00
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Butter';

-- Frozen Berries: was unpriced -> $11.50/kg (Bidfood I71408522, Berries Mixed IQF Caterers 1kg)
UPDATE stock_items SET pack_size = 1000, pack_cost = 11.50
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Frozen Berries';

-- Sauerkraut: $6.27/kg (2.5kg@$15.68) -> $5.55/kg (Bidfood I71408522, Marcopolo 2.4kg@$13.32)
UPDATE stock_items SET pack_size = 2400, pack_cost = 13.32
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Sauerkraut';

-- Greek Yoghurt: $7.79/kg -> $8.51/kg (Bidfood I71408522, Chobani 2kg@$17.02 -- same pack size)
UPDATE stock_items SET pack_size = 2000, pack_cost = 17.02
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Greek Yoghurt';

-- Chickpea: $2.75/kg (1kg) -> $2.80/kg (Bidfood I71408522, Alfinas 2.5kg@$7.00 -- pack size also changed)
UPDATE stock_items SET pack_size = 2500, pack_cost = 7.00
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chickpea';

-- Swiss (cheese): $17.00/kg -> $17.18/kg (Bidfood I71389131 & I71408522, Kebia 1kg -- consistent both invoices)
UPDATE stock_items SET pack_size = 1000, pack_cost = 17.18
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Swiss';

-- Tuna: $4.50/tin -> $4.58/tin (Bidfood I71389131 & I71408522, Safcol 12x425g carton @ $55.00 / 12)
UPDATE stock_items SET pack_size = 425, pack_cost = 4.58
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Tuna';

-- Mango: $11.12/kg -> $9.84/kg (Bidfood I71408522, Speedy Berries diced IQF 1kg -- now frozen diced, was priced as fresh)
UPDATE stock_items SET pack_size = 1000, pack_cost = 9.84
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Mango';

-- Mayo: $7.92/kg (1kg) -> $8.23/kg (Bidfood I71408522, Birch & Waite whole egg GF 15kg@$123.42 -- pack size also changed)
UPDATE stock_items SET pack_size = 15000, pack_cost = 123.42
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Mayo';

-- American Cheese: $13.21/kg (1kg) -> $10.29/kg (Bidfood I71389131, Real Dairy 2.27kg@$23.35 -- pack size also changed)
UPDATE stock_items SET pack_size = 2270, pack_cost = 23.35
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'American Cheese';

-- Pickles: $6.11/kg (1kg) -> $6.39/kg (Bread & Butter, Westmont 5kg -- averaged across two invoices: $31.88 + $32.00)
UPDATE stock_items SET pack_size = 5000, pack_cost = 31.94
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Pickles';

-- Confirmed accurate, no change needed (skipped): Bacon $14.50/kg, Turkey $22.95/kg,
-- Ham $23.50/kg, Coconut Milk $6.45/L -- all match the current catalog price exactly.

-- ── VERIFY ────────────────────────────────────────────────────
SELECT name, pack_size, pack_cost, cost_per_uom
FROM stock_items
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1)
  AND name IN ('Roast Beef','Pastrami','Butter','Frozen Berries','Sauerkraut','Greek Yoghurt',
               'Chickpea','Swiss','Tuna','Mango','Mayo','American Cheese','Pickles')
ORDER BY name;
