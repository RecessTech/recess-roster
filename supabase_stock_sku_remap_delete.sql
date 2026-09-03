-- ============================================================
-- R-Stock: delete the 22 "fix" SKUs after verifying the remap
-- ============================================================
-- Run this ONLY after you've checked the VERIFY query in
-- supabase_stock_sku_remap_20260903.sql and confirmed each 'map_to'
-- row now has the right data and picked up the recipe references
-- (and each 'fix' row shows 0 component_refs / 0 menu_refs).
-- ============================================================

DELETE FROM stock_items
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1)
  AND name IN ('Parmesan','Salt','Mushrooms','Pickles','Bacon','Cos','Sundried Tomato','Cherry Tomato',
               'Avocado','Tomato Relish','Chia','Chickpea','Egg','Turkey','Almonds','Coconut Flakes',
               'Crispy Shallots','Feta','Granola','Greek Yoghurt','Olive Oil','Chicken (Raw)')
  AND sku NOT IN ('SKU-0099','SKU-0041','SKU-0154','SKU-0001','SKU-0092','SKU-0077','SKU-0012','SKU-0071',
                  'SKU-0069','SKU-0002','SKU-0060','SKU-0039','SKU-0096','SKU-0095','SKU-0052','SKU-0037',
                  'SKU-0065','SKU-0098','SKU-0051','SKU-0100','SKU-0047','SKU-0090');
