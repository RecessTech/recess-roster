-- ============================================================
-- R-Barista: Cold Foam category + yield-scalable batch recipes
-- Run this in the R-Shift Supabase project SQL editor
-- ============================================================
-- Cold foams are batch preps (a fixed recipe scaled to a yield), not
-- individually-sold menu items -- they already fit recipe_components
-- (which already has batch_yield) far better than production_items.
-- This lets drink_guides point at EITHER a production_item OR a
-- recipe_component, so the Drinks Guide can group items by category
-- and, for a component-based guide, let staff enter a target yield on
-- the mobile page and have every ingredient scale proportionally
-- (qty * enteredYield / batch_yield) -- no new scaling data needed,
-- since batch_yield + line qty already encode the recipe's ratios.

-- ── 1. drink_guides: allow a component subject, not just a menu item ──

ALTER TABLE drink_guides ALTER COLUMN production_item_id DROP NOT NULL;
ALTER TABLE drink_guides ADD COLUMN IF NOT EXISTS component_id UUID REFERENCES recipe_components(id) ON DELETE CASCADE;

ALTER TABLE drink_guides ADD CONSTRAINT drink_guides_subject_check
  CHECK ((production_item_id IS NOT NULL)::int + (component_id IS NOT NULL)::int = 1);

DROP INDEX IF EXISTS idx_drink_guides_one_active_per_item;
CREATE UNIQUE INDEX idx_drink_guides_one_active_per_item
  ON drink_guides(production_item_id) WHERE active AND production_item_id IS NOT NULL;
CREATE UNIQUE INDEX idx_drink_guides_one_active_per_component
  ON drink_guides(component_id) WHERE active AND component_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_drink_guides_component ON drink_guides(component_id);

-- ── 2. recipe_components: a category to group the Drinks Guide by ─────
-- Mirrors stock_items.category/production_items.category. NULL for the
-- many recipe_components that are sandwich fillings etc. and have no
-- business showing up in the Drinks Guide at all -- only components
-- with a category set are eligible to appear there.

ALTER TABLE recipe_components ADD COLUMN IF NOT EXISTS category TEXT;

-- ── 3. New stock items the recipes below need ──────────────────────────
-- Unpriced placeholders (pack_size/pack_cost left NULL), same pattern
-- as 'Bread (g)'/'Frozen Berries' in supabase_recipes_seed_data.sql --
-- real supplier pricing to be entered later in R-Stock.

INSERT INTO stock_items (org_id, name, uom, category)
  SELECT (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1), 'Cinnamon', 'g', 'DRY'
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Cinnamon');

INSERT INTO stock_items (org_id, name, uom, category)
  SELECT (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1), 'Vanilla Extract', 'g', 'DRY'
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Vanilla Extract');

-- ── 4. Cold Foam recipe_components ──────────────────────────────────────
-- 'Banana Cold Foam' already existed (referenced by Banana Iced Latte's
-- recipe) but with a stale placeholder uom/batch_yield ('g'/1000) and no
-- lines -- corrected here to the real 700mL batch, uom='ml'.

UPDATE recipe_components
  SET uom = 'ml', batch_yield = 700, category = 'Cold Foam'
  WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Banana Cold Foam';

INSERT INTO recipe_components (org_id, name, type, uom, batch_yield, category)
  SELECT (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1), 'Milo Cold Foam', 'prep', 'ml', 700, 'Cold Foam'
  WHERE NOT EXISTS (SELECT 1 FROM recipe_components WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Milo Cold Foam');

INSERT INTO recipe_components (org_id, name, type, uom, batch_yield, category)
  SELECT (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1), 'Strawberry Cold Foam', 'prep', 'ml', 500, 'Cold Foam'
  WHERE NOT EXISTS (SELECT 1 FROM recipe_components WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Strawberry Cold Foam');

INSERT INTO recipe_components (org_id, name, type, uom, batch_yield, category)
  SELECT (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1), 'Maple Cold Foam', 'prep', 'ml', 500, 'Cold Foam'
  WHERE NOT EXISTS (SELECT 1 FROM recipe_components WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Maple Cold Foam');

-- ── 5. Cold Foam recipe lines (at the reference batch yield above) ─────
-- Cream = Thickened Cream, Milk = Full Cream Milk, Vanilla = Vanilla
-- Syrup (the mL, pourable one -- distinct from the 6g Vanilla Extract
-- in Maple), Strawberry = Strawberry Puree (mL, matching the recipe's
-- mL figure -- not whole Strawberries), Salt = Table Salt (not the
-- coarse Flaky Salt used for garnish).

INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Banana Cold Foam'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Thickened Cream'),
    262.0, 0;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Banana Cold Foam'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Full Cream Milk'),
    175.0, 1;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Banana Cold Foam'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Banana Puree'),
    196.0, 2;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Banana Cold Foam'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Vanilla Syrup'),
    65.0, 3;

INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Milo Cold Foam'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Thickened Cream'),
    262.0, 0;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Milo Cold Foam'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Full Cream Milk'),
    175.0, 1;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Milo Cold Foam'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Milo'),
    252.0, 2;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Milo Cold Foam'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Vanilla Syrup'),
    58.0, 3;

INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Strawberry Cold Foam'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Thickened Cream'),
    214.0, 0;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Strawberry Cold Foam'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Full Cream Milk'),
    143.0, 1;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Strawberry Cold Foam'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Strawberry Puree'),
    143.0, 2;

INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Maple Cold Foam'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Thickened Cream'),
    214.0, 0;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Maple Cold Foam'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Full Cream Milk'),
    143.0, 1;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Maple Cold Foam'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Maple Syrup'),
    143.0, 2;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Maple Cold Foam'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Cinnamon'),
    2.0, 3;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Maple Cold Foam'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Vanilla Extract'),
    6.0, 4;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Maple Cold Foam'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_items WHERE name = 'Espresso' LIMIT 1) AND name = 'Table Salt'),
    1.0, 5;

-- ── VERIFY ─────────────────────────────────────────────────────
SELECT rc.name AS cold_foam, rc.batch_yield, rc.uom, si.name AS ingredient, rcl.qty
FROM recipe_components rc
JOIN recipe_component_lines rcl ON rcl.component_id = rc.id
JOIN stock_items si ON si.id = rcl.stock_item_id
WHERE rc.category = 'Cold Foam'
ORDER BY rc.name, rcl.sort_order;
