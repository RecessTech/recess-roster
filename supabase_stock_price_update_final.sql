-- ============================================================
-- R-Stock: consolidated price update -- everything outstanding
-- from the invoice reconciliation
-- ============================================================

-- ── Direct name matches (confirmed present in the catalog dump) ─
UPDATE stock_items SET pack_size = 1000, pack_cost = 17.00
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Butter';

UPDATE stock_items SET pack_size = 1000, pack_cost = 11.50
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Frozen Berries';

UPDATE stock_items SET pack_size = 2400, pack_cost = 13.32
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Sauerkraut';

UPDATE stock_items SET pack_size = 1000, pack_cost = 17.18
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Swiss';

UPDATE stock_items SET pack_size = 425, pack_cost = 4.58
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Tuna';

UPDATE stock_items SET pack_size = 15000, pack_cost = 123.42
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Mayo';

UPDATE stock_items SET pack_size = 2270, pack_cost = 23.35
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'American Cheese';

-- ── Unconfirmed name matches -- harmless no-op if the name isn't
-- actually what's in the catalog (see the fuzzy search at the bottom) ──
UPDATE stock_items SET pack_size = 1000, pack_cost = 26.95
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Roast Beef';

UPDATE stock_items SET pack_size = 1000, pack_cost = 25.95
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Pastrami';

-- ── Items already consumed by the 22-item SKU remap -- target the
-- survivor SKU directly with the real invoice price ─────────────
UPDATE stock_items SET pack_size = 5000, pack_cost = 31.94 WHERE sku = 'SKU-0001'; -- Pickled Cucumber
UPDATE stock_items SET pack_size = 2500, pack_cost = 7.00  WHERE sku = 'SKU-0039'; -- Canned Chickpeas (Big)
UPDATE stock_items SET pack_size = 2000, pack_cost = 17.02 WHERE sku = 'SKU-0100'; -- Yoghurt
UPDATE stock_items SET pack_size = 5000, pack_cost = 55.00 WHERE sku = 'SKU-0012'; -- Sundried Tomato Strips

-- ── Previously-unpriced SKUs matched to the Bidfood invoices ────
UPDATE stock_items SET pack_size = 12, pack_cost = 20.46 WHERE sku = 'SKU-0106'; -- Full Cream Milk
UPDATE stock_items SET pack_size = 12, pack_cost = 20.53 WHERE sku = 'SKU-0107'; -- Skim Milk
UPDATE stock_items SET pack_size = 12, pack_cost = 37.08 WHERE sku = 'SKU-0108'; -- Almond Milk
UPDATE stock_items SET pack_size = 12, pack_cost = 35.64 WHERE sku = 'SKU-0109'; -- Oat Milk
UPDATE stock_items SET pack_size = 12, pack_cost = 35.16 WHERE sku = 'SKU-0110'; -- Soy Milk
UPDATE stock_items SET pack_size = 1,  pack_cost = 3.02  WHERE sku = 'SKU-0129'; -- Passionfruit Pulp
UPDATE stock_items SET pack_size = 1,  pack_cost = 7.67  WHERE sku = 'SKU-0017'; -- Tomato Sauce
UPDATE stock_items SET pack_size = 1,  pack_cost = 6.19  WHERE sku = 'SKU-0123'; -- Water
UPDATE stock_items SET pack_size = 1,  pack_cost = 21.11 WHERE sku = 'SKU-0116'; -- Vanilla Syrup
UPDATE stock_items SET pack_size = 1,  pack_cost = 23.06 WHERE sku = 'SKU-0131'; -- Chai Powder

-- ── User-confirmed mappings ───────────────────────────────────
UPDATE stock_items SET pack_size = 2000, pack_cost = 25.92 WHERE sku = 'SKU-0098'; -- Fetta (Cheese Fetta Danish)
UPDATE stock_items SET pack_size = 1000, pack_cost = 24.00 WHERE sku = 'SKU-0090'; -- Chicken Breast (Tenderloin)

-- ── VERIFY: everything touched above ─────────────────────────
SELECT name, sku, uom, pack_size, pack_cost, cost_per_uom
FROM stock_items
WHERE sku IN ('SKU-0001','SKU-0039','SKU-0100','SKU-0012','SKU-0106','SKU-0107','SKU-0108','SKU-0109',
              'SKU-0110','SKU-0129','SKU-0017','SKU-0123','SKU-0116','SKU-0131','SKU-0098','SKU-0090')
   OR name IN ('Butter','Frozen Berries','Sauerkraut','Swiss','Tuna','Mayo','American Cheese','Roast Beef','Pastrami')
ORDER BY name;

-- ── Fuzzy search: catch a Roast Beef / Pastrami nickname variant
-- if one exists (e.g. "Roast Beef Sliced", "Pastrami Sliced") ────
SELECT name, sku, category, pack_size, pack_cost
FROM stock_items
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1)
  AND (name ILIKE '%roast beef%' OR name ILIKE '%pastrami%')
ORDER BY name;
