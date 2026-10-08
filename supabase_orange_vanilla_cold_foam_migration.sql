-- ============================================================
-- R-Barista: Orange Vanilla Cold Foam
-- Run this in the R-Shift Supabase project SQL editor
-- ============================================================
-- Same 'Cold Foam' category/batch-prep pattern as the other five (see
-- supabase_cold_foam_guides_migration.sql, supabase_coconut_cold_foam_migration.sql).
-- Maison Routin Orange syrup maps onto a new 'Orange Syrup' stock item
-- (dropping the brand prefix, matching the existing Vanilla Syrup /
-- Maple Syrup naming), uom 'g' since the recipe weighs it rather than
-- measuring by volume. Brown Sugar is also new. Both left unpriced
-- (pack_size/pack_cost NULL) until real supplier cost is entered in
-- R-Stock.

INSERT INTO stock_items (org_id, name, uom, category)
  SELECT (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1), 'Orange Syrup', 'g', 'DRY'
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Orange Syrup');

INSERT INTO stock_items (org_id, name, uom, category)
  SELECT (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1), 'Brown Sugar', 'g', 'DRY'
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Brown Sugar');

-- Batch yield = 190 (cream) + 180 (milk) + 5 (vanilla extract, explicitly
-- given in mL) = 375mL. The syrup, brown sugar and salt are all weighed
-- (g) rather than measured by volume -- same treatment as every other
-- cold foam's small weighed additions (Maple's cinnamon, Coconut's
-- salt) -- so they're not force-converted into the headline mL figure.
INSERT INTO recipe_components (org_id, name, type, uom, batch_yield, category)
  SELECT (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1), 'Orange Vanilla Cold Foam', 'prep', 'ml', 375, 'Cold Foam'
  WHERE NOT EXISTS (SELECT 1 FROM recipe_components WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Orange Vanilla Cold Foam');

-- Vanilla extract given as "1 tsp (5ml)" -- converted to 5g (~1:1,
-- vanilla extract's density is close to water) since the Vanilla
-- Extract SKU is weighed in grams, matching Maple's use of the same SKU.
-- Salt given as "1/8 tsp" -- converted to 0.75g (half of the 1/4 tsp ->
-- 1.5g conversion used for Coconut Cold Foam's pinch of salt).
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Orange Vanilla Cold Foam'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Thickened Cream'),
    190.0, 0;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Orange Vanilla Cold Foam'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Full Cream Milk'),
    180.0, 1;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Orange Vanilla Cold Foam'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Orange Syrup'),
    80.0, 2;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Orange Vanilla Cold Foam'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Vanilla Extract'),
    5.0, 3;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Orange Vanilla Cold Foam'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Brown Sugar'),
    20.0, 4;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Orange Vanilla Cold Foam'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Table Salt'),
    0.75, 5;

-- ── VERIFY ─────────────────────────────────────────────────────
SELECT rc.name AS cold_foam, rc.batch_yield, rc.uom, si.name AS ingredient, rcl.qty
FROM recipe_components rc
JOIN recipe_component_lines rcl ON rcl.component_id = rc.id
JOIN stock_items si ON si.id = rcl.stock_item_id
WHERE rc.name = 'Orange Vanilla Cold Foam'
ORDER BY rcl.sort_order;
