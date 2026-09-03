-- ============================================================
-- R-Stock: reconciliation against Bidfood master pricelist
-- ============================================================

-- ── Fix: these were scaled by litres/count instead of grams in an
-- earlier batch -- correcting to match the rest of the catalog's
-- gram-scaled convention (same $ price, just the right pack_size) ──
UPDATE stock_items SET pack_size = 12000, pack_cost = 20.46 WHERE sku = 'SKU-0106'; -- Full Cream Milk
UPDATE stock_items SET pack_size = 12000, pack_cost = 20.53 WHERE sku = 'SKU-0107'; -- Skim Milk
UPDATE stock_items SET pack_size = 12000, pack_cost = 37.08 WHERE sku = 'SKU-0108'; -- Almond Milk
UPDATE stock_items SET pack_size = 12000, pack_cost = 35.64 WHERE sku = 'SKU-0109'; -- Oat Milk
UPDATE stock_items SET pack_size = 12000, pack_cost = 35.16 WHERE sku = 'SKU-0110'; -- Soy Milk
UPDATE stock_items SET pack_size = 170,   pack_cost = 3.02  WHERE sku = 'SKU-0129'; -- Passionfruit Pulp
UPDATE stock_items SET pack_size = 920,   pack_cost = 7.67  WHERE sku = 'SKU-0017'; -- Tomato Sauce
UPDATE stock_items SET pack_size = 7200,  pack_cost = 6.19  WHERE sku = 'SKU-0123'; -- Water
UPDATE stock_items SET pack_size = 1000,  pack_cost = 21.11 WHERE sku = 'SKU-0116'; -- Vanilla Syrup
UPDATE stock_items SET pack_size = 1000,  pack_cost = 23.06 WHERE sku = 'SKU-0131'; -- Chai Powder

-- ── Price refresh on already-matched SKUs ────────────────────────
UPDATE stock_items SET pack_size = 4800, pack_cost = 48.80 WHERE sku = 'SKU-0008'; -- Chilli Jam
UPDATE stock_items SET pack_size = 2270, pack_cost = 23.95 WHERE sku = 'SKU-0102'; -- American Cheese
UPDATE stock_items SET pack_size = 2000, pack_cost = 34.24 WHERE sku = 'SKU-0099'; -- Grated Parmesan
UPDATE stock_items SET pack_size = 2000, pack_cost = 27.73 WHERE sku = 'SKU-0098'; -- Fetta
UPDATE stock_items SET pack_size = 9000, pack_cost = 87.17 WHERE sku = 'SKU-0096'; -- Eggs
UPDATE stock_items SET pack_size = 1500, pack_cost = 28.74 WHERE sku = 'SKU-0101'; -- Butter
UPDATE stock_items SET pack_size = 5000, pack_cost = 31.88 WHERE sku = 'SKU-0001'; -- Pickled Cucumber
UPDATE stock_items SET pack_size = 2000, pack_cost = 27.53 WHERE sku = 'SKU-0003'; -- Pesto
UPDATE stock_items SET pack_size = 2000, pack_cost = 20.06 WHERE sku = 'SKU-0002'; -- Tomato Chutney
UPDATE stock_items SET pack_size = 1000, pack_cost = 13.08 WHERE sku = 'SKU-0036'; -- Quinoa
UPDATE stock_items SET pack_size = 1000, pack_cost = 10.63 WHERE sku = 'SKU-0035'; -- Pepitas
UPDATE stock_items SET pack_size = 4000, pack_cost = 48.90 WHERE sku = 'SKU-0047'; -- Olive Oil - Extra Virgin
UPDATE stock_items SET pack_size = 5000, pack_cost = 10.90 WHERE sku = 'SKU-0044'; -- White Wine Vinegar
UPDATE stock_items SET pack_size = 920,  pack_cost = 8.24  WHERE sku = 'SKU-0011'; -- American Mustard

-- ── New matches (previously unpriced) ────────────────────────────
UPDATE stock_items SET pack_size = 1120, pack_cost = 19.32 WHERE sku = 'SKU-0144'; -- Chobani Pouch Strawberry
UPDATE stock_items SET pack_size = 9000, pack_cost = 32.86 WHERE sku = 'SKU-0120'; -- Coke Zero (No Sugar Cans)
UPDATE stock_items SET pack_size = 9000, pack_cost = 32.86 WHERE sku = 'SKU-0121'; -- Diet Coke
UPDATE stock_items SET pack_size = 1000, pack_cost = 40.93 WHERE sku = 'SKU-0113'; -- Strawberry Puree

-- ── Already correct, confirmed by this list, no change ───────────
-- Swiss, Mayo, Sauerkraut, Canned Chickpeas (Big), Tuna,
-- Coconut Milk, Frozen Berries, Frozen Mango, Yoghurt (Chobani)

-- ── VERIFY ─────────────────────────────────────────────────────
SELECT name, sku, uom, pack_size, pack_cost, cost_per_uom
FROM stock_items
WHERE sku IN ('SKU-0106','SKU-0107','SKU-0108','SKU-0109','SKU-0110','SKU-0129','SKU-0017','SKU-0123',
              'SKU-0116','SKU-0131','SKU-0008','SKU-0102','SKU-0099','SKU-0098','SKU-0096','SKU-0101',
              'SKU-0001','SKU-0003','SKU-0002','SKU-0036','SKU-0035','SKU-0047','SKU-0044','SKU-0011',
              'SKU-0144','SKU-0120','SKU-0121','SKU-0113')
ORDER BY name;
