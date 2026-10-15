-- ============================================================
-- R-Barista: Coconut Cold Foam
-- Run this in the R-Shift Supabase project SQL editor
-- ============================================================
-- Same 'Cold Foam' category/batch-prep pattern as Banana/Milo/
-- Strawberry/Maple Cold Foam (see supabase_cold_foam_guides_migration.sql).
-- Monin Coconut Fruit Mix maps onto a new 'Coconut Puree' stock item,
-- matching the existing Banana Puree / Strawberry Puree naming
-- convention for Monin fruit mixes -- left unpriced (pack_size/pack_cost
-- NULL) like Cinnamon/Vanilla Extract until real supplier pricing is
-- entered in R-Stock.

INSERT INTO stock_items (org_id, name, uom, category)
  SELECT (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1), 'Coconut Puree', 'ml', 'DRY'
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Coconut Puree');

-- Batch yield = 262 + 175 + 196 = 633mL (the recipe's salt pinch is a
-- dry addition, not counted toward the liquid yield -- same treatment
-- as Maple's cinnamon/vanilla extract/salt).
INSERT INTO recipe_components (org_id, name, type, uom, batch_yield, category)
  SELECT (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1), 'Coconut Cold Foam', 'prep', 'ml', 633, 'Cold Foam'
  WHERE NOT EXISTS (SELECT 1 FROM recipe_components WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Coconut Cold Foam');

-- Salt is "pinch, ~1/4 tsp, adjust to taste" in the source recipe --
-- converted to 1.5g (1/4 of a ~6g teaspoon of table salt) so it can be
-- costed/scaled like every other line; still Table Salt, not the
-- coarse Flaky Salt used for garnish elsewhere.
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Coconut Cold Foam'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Thickened Cream'),
    262.0, 0;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Coconut Cold Foam'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Full Cream Milk'),
    175.0, 1;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Coconut Cold Foam'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Coconut Puree'),
    196.0, 2;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Coconut Cold Foam'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Table Salt'),
    1.5, 3;

-- ── VERIFY ─────────────────────────────────────────────────────
SELECT rc.name AS cold_foam, rc.batch_yield, rc.uom, si.name AS ingredient, rcl.qty
FROM recipe_components rc
JOIN recipe_component_lines rcl ON rcl.component_id = rc.id
JOIN stock_items si ON si.id = rcl.stock_item_id
WHERE rc.name = 'Coconut Cold Foam'
ORDER BY rcl.sort_order;
