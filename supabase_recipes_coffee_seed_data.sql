-- ============================================================
-- R-Recipe: Coffee & Tea (coffee-based drinks) seed data
-- Run this AFTER supabase_recipes_migration.sql and
-- supabase_recipe_lines_packaging_flag.sql
--
-- One-time bootstrap import — safe to run once. Re-running will
-- create duplicate ingredient lines (no dedup on those tables),
-- same caveat as supabase_recipes_seed_data.sql.
--
-- Org resolved via the existing 'Crown St' production site, same
-- anchor used throughout the rest of the recipe system.
--
-- METHODOLOGY
-- -----------
-- Coffee is purchased by weight (5kg whole-bean bags) and costed
-- by weight (grams of ground coffee dosed into the portafilter),
-- NOT by the mL of brewed liquid that comes out. A "shot" = 20g
-- dose regardless of single/double naming; a double shot is two
-- 20g pulls (40g). The 30mL-per-shot yield figure only matters
-- for sizing how much milk tops up a drink to its cup volume —
-- it is never used as a costed quantity itself.
--
-- Cup volumes (Detpak-style round sizes, not exact fl-oz math):
--   Small = 6oz = 180mL, Medium = 8oz = 240mL, Large = 10oz = 300mL
--   (Espresso/Piccolo = 4oz = 120mL, unsized item, no milk)
-- Milk-based coffee drinks (Flat White/Cappuccino/Latte/Mocha):
--   milk = cup volume - shot yield (froth ratio doesn't change
--   the underlying liquid cost, so all three get the same milk
--   figure at a given size).
-- Hot Chocolate/Chai Latte/Matcha Latte have no coffee; their
-- flavour base follows the same single/double dose doubling
-- pattern as coffee (S/M = single dose, L = double dose).
--
-- Chai Concentrate, Drinking Chocolate Powder and Matcha Powder
-- are seeded with no pack_size/pack_cost (unpriced) — same
-- pattern already used for 'Bread (g)' and 'Frozen Berries' in
-- supabase_recipes_seed_data.sql. Their recipe lines will cost
-- $0/NULL until real supplier pricing is entered; only the
-- Coffee Beans SKU is fully priced, so every coffee-containing
-- drink gets a real cost immediately.
--
-- Sell prices ($5.20/$5.50/$6.20 for Small/Medium/Large) are
-- applied to every sized Coffee & Tea item, per instruction —
-- Espresso (unsized) is left untouched.
-- ============================================================

-- ── 1. SKU PRICING ─────────────────────────────────────────

UPDATE stock_items SET uom = 'g', category = 'DRY', pack_size = 5000.0, pack_cost = 180.0, order_pack_label = 'bag'
  WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Coffee Beans';
INSERT INTO stock_items (org_id, name, uom, category, pack_size, pack_cost, order_pack_label)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Coffee Beans', 'g', 'DRY', 5000.0, 180.0, 'bag'
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Coffee Beans');

INSERT INTO stock_items (org_id, name, uom, category)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Drinking Chocolate Powder', 'g', 'DRY'
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Drinking Chocolate Powder');

INSERT INTO stock_items (org_id, name, uom, category)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Chai Concentrate', 'ml', 'DRY'
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chai Concentrate');

INSERT INTO stock_items (org_id, name, uom, category)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Matcha Powder', 'g', 'DRY'
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Matcha Powder');

-- ── 2. RECIPE COMPONENTS ───────────────────────────────────
-- Reusable "shot" preps so every drink references 1 or 2 shots
-- instead of duplicating the 20g coffee dose everywhere.

INSERT INTO recipe_components (org_id, name, type, uom, batch_yield)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Single Espresso Shot', 'prep', 'g', 1.0
  WHERE NOT EXISTS (SELECT 1 FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Single Espresso Shot');
INSERT INTO recipe_components (org_id, name, type, uom, batch_yield)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Double Espresso Shot', 'prep', 'g', 1.0
  WHERE NOT EXISTS (SELECT 1 FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Double Espresso Shot');

-- ── 3. RECIPE COMPONENT LINES ───────────────────────────────

INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Single Espresso Shot'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Coffee Beans'),
    20.0, 0;

INSERT INTO recipe_component_lines (org_id, component_id, sub_component_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Double Espresso Shot'),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Single Espresso Shot'),
    2.0, 0;

-- ── 4. SELL PRICES ───────────────────────────────────────────
-- Flat S/M/L tier across every sized Coffee & Tea item. Espresso
-- (unsized) is intentionally left untouched.

UPDATE production_items SET sell_price = 5.20 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name IN ('Flat White (Small)', 'Cappuccino (Small)', 'Latte (Small)', 'Mocha (Small)', 'Hot Chocolate (Small)', 'Chai Latte (Small)', 'Matcha Latte (Small)');
UPDATE production_items SET sell_price = 5.50 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name IN ('Flat White (Medium)', 'Cappuccino (Medium)', 'Latte (Medium)', 'Mocha (Medium)', 'Hot Chocolate (Medium)', 'Chai Latte (Medium)', 'Matcha Latte (Medium)');
UPDATE production_items SET sell_price = 6.20 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name IN ('Flat White (Large)', 'Cappuccino (Large)', 'Latte (Large)', 'Mocha (Large)', 'Hot Chocolate (Large)', 'Chai Latte (Large)', 'Matcha Latte (Large)');

-- ── 5. MENU ITEM RECIPE LINES ─────────────────────────────────
-- Milk-based coffee drinks: milk = cup volume - shot yield (30mL/shot).
--   Small (180mL) - 1 shot (30mL) = 150mL
--   Medium (240mL) - 1 shot (30mL) = 210mL
--   Large (300mL) - 2 shots (60mL) = 240mL

INSERT INTO recipe_menu_item_lines (org_id, item_id, component_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Flat White (Small)'),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Single Espresso Shot'),
    1.0, 0;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Flat White (Small)'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Full Cream Milk'),
    150.0, 1;

INSERT INTO recipe_menu_item_lines (org_id, item_id, component_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Flat White (Medium)'),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Single Espresso Shot'),
    1.0, 0;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Flat White (Medium)'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Full Cream Milk'),
    210.0, 1;

INSERT INTO recipe_menu_item_lines (org_id, item_id, component_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Flat White (Large)'),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Double Espresso Shot'),
    1.0, 0;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Flat White (Large)'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Full Cream Milk'),
    240.0, 1;

INSERT INTO recipe_menu_item_lines (org_id, item_id, component_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Cappuccino (Small)'),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Single Espresso Shot'),
    1.0, 0;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Cappuccino (Small)'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Full Cream Milk'),
    150.0, 1;

INSERT INTO recipe_menu_item_lines (org_id, item_id, component_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Cappuccino (Medium)'),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Single Espresso Shot'),
    1.0, 0;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Cappuccino (Medium)'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Full Cream Milk'),
    210.0, 1;

INSERT INTO recipe_menu_item_lines (org_id, item_id, component_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Cappuccino (Large)'),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Double Espresso Shot'),
    1.0, 0;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Cappuccino (Large)'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Full Cream Milk'),
    240.0, 1;

INSERT INTO recipe_menu_item_lines (org_id, item_id, component_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Latte (Small)'),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Single Espresso Shot'),
    1.0, 0;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Latte (Small)'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Full Cream Milk'),
    150.0, 1;

INSERT INTO recipe_menu_item_lines (org_id, item_id, component_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Latte (Medium)'),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Single Espresso Shot'),
    1.0, 0;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Latte (Medium)'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Full Cream Milk'),
    210.0, 1;

INSERT INTO recipe_menu_item_lines (org_id, item_id, component_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Latte (Large)'),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Double Espresso Shot'),
    1.0, 0;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Latte (Large)'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Full Cream Milk'),
    240.0, 1;

-- Espresso: unsized, 1 shot, no milk. Sell price intentionally untouched.
INSERT INTO recipe_menu_item_lines (org_id, item_id, component_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Espresso'),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Single Espresso Shot'),
    1.0, 0;

-- Mocha: coffee + chocolate + milk (milk = cup volume - shot yield, chocolate dissolves).
INSERT INTO recipe_menu_item_lines (org_id, item_id, component_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Mocha (Small)'),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Single Espresso Shot'),
    1.0, 0;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Mocha (Small)'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Drinking Chocolate Powder'),
    15.0, 1;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Mocha (Small)'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Full Cream Milk'),
    150.0, 2;

INSERT INTO recipe_menu_item_lines (org_id, item_id, component_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Mocha (Medium)'),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Single Espresso Shot'),
    1.0, 0;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Mocha (Medium)'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Drinking Chocolate Powder'),
    15.0, 1;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Mocha (Medium)'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Full Cream Milk'),
    210.0, 2;

INSERT INTO recipe_menu_item_lines (org_id, item_id, component_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Mocha (Large)'),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Double Espresso Shot'),
    1.0, 0;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Mocha (Large)'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Drinking Chocolate Powder'),
    30.0, 1;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Mocha (Large)'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Full Cream Milk'),
    240.0, 2;

-- Hot Chocolate: no coffee, milk fills the full cup.
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Hot Chocolate (Small)'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Drinking Chocolate Powder'),
    15.0, 0;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Hot Chocolate (Small)'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Full Cream Milk'),
    180.0, 1;

INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Hot Chocolate (Medium)'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Drinking Chocolate Powder'),
    15.0, 0;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Hot Chocolate (Medium)'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Full Cream Milk'),
    240.0, 1;

INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Hot Chocolate (Large)'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Drinking Chocolate Powder'),
    30.0, 0;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Hot Chocolate (Large)'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Full Cream Milk'),
    300.0, 1;

-- Chai Latte: no coffee, milk = cup volume - chai concentrate.
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chai Latte (Small)'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chai Concentrate'),
    60.0, 0;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chai Latte (Small)'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Full Cream Milk'),
    120.0, 1;

INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chai Latte (Medium)'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chai Concentrate'),
    60.0, 0;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chai Latte (Medium)'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Full Cream Milk'),
    180.0, 1;

INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chai Latte (Large)'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chai Concentrate'),
    120.0, 0;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chai Latte (Large)'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Full Cream Milk'),
    180.0, 1;

-- Matcha Latte: no coffee, milk fills the full cup (powder volume negligible).
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Matcha Latte (Small)'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Matcha Powder'),
    2.0, 0;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Matcha Latte (Small)'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Full Cream Milk'),
    180.0, 1;

INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Matcha Latte (Medium)'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Matcha Powder'),
    2.0, 0;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Matcha Latte (Medium)'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Full Cream Milk'),
    240.0, 1;

INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Matcha Latte (Large)'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Matcha Powder'),
    4.0, 0;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Matcha Latte (Large)'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Full Cream Milk'),
    300.0, 1;

-- ── VERIFY ─────────────────────────────────────────────────────
-- Single Espresso Shot should cost 20g x $0.036/g = $0.72;
-- Double should be $1.44 (2x the single, via nesting).
SELECT rc.name, rc.batch_yield,
       round(rcl.qty * COALESCE(si.cost_per_uom, sub.batch_yield * 0.036), 4) AS line_cost
FROM recipe_components rc
JOIN recipe_component_lines rcl ON rcl.component_id = rc.id
LEFT JOIN stock_items si ON si.id = rcl.stock_item_id
LEFT JOIN recipe_components sub ON sub.id = rcl.sub_component_id
WHERE rc.org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1)
  AND rc.name IN ('Single Espresso Shot', 'Double Espresso Shot');

-- Every Coffee & Tea recipe line, for a manual eyeball check. Lines
-- with a NULL cost_per_uom (Chai Concentrate/Drinking Chocolate
-- Powder/Matcha Powder) are expected until those SKUs are priced;
-- component lines (Single/Double Espresso Shot) show NULL here too
-- since their cost is resolved recursively by the app, not this join.
SELECT pi.name AS menu_item, pi.sell_price,
       COALESCE(si.name, rc.name) AS ingredient,
       rml.qty,
       si.cost_per_uom
FROM production_items pi
JOIN recipe_menu_item_lines rml ON rml.item_id = pi.id
LEFT JOIN stock_items si ON si.id = rml.stock_item_id
LEFT JOIN recipe_components rc ON rc.id = rml.component_id
WHERE pi.org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1)
  AND pi.category = 'Coffee & Tea'
ORDER BY pi.name, rml.sort_order;
