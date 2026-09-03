-- ============================================================
-- R-Recipe: Seed data imported from the RFT spreadsheet
-- Run this AFTER supabase_recipes_migration.sql
--
-- One-time bootstrap import — safe to run once. Re-running will
-- create duplicate ingredient lines (no dedup on those tables).
--
-- Org is resolved via the existing 'Crown St' production site.
-- Menu item names cross-checked against a live export of your
-- actual production_items — 'Big Tuna' and 'Mushroom & Egg' are
-- written to match what's really there; 6 others (Turkey Brie &
-- Cranberry, Mango Chia Pudding, Yoghurt Cup, Protein Ball, Coca
-- Cola, Samboys) don't exist yet and will be created new.
-- ============================================================

-- ── 1. SKU PRICING ─────────────────────────────────────────
-- UPDATEs an existing SKU's pricing if the name already matches
-- (from R-Stock); otherwise INSERTs a new SKU. 'Bread (g)' is
-- kept distinct from the existing 'Bread' (sold/priced per
-- slice) since Croutons' recipe measures it in grams instead.

UPDATE stock_items SET pack_size = 12.0, pack_cost = 8.91 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Bread';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Bread', 'slice', 12.0, 8.91
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Bread');

UPDATE stock_items SET pack_size = 1000.0, pack_cost = 17.73 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Butter';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Butter', 'g', 1000.0, 17.73
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Butter');

UPDATE stock_items SET pack_size = 2500.0, pack_cost = 36.25 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Bacon';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Bacon', 'g', 2500.0, 36.25
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Bacon');

UPDATE stock_items SET pack_size = 1000.0, pack_cost = 11.17 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chicken (Raw)';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Chicken (Raw)', 'g', 1000.0, 11.17
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chicken (Raw)');

UPDATE stock_items SET pack_size = 1000.0, pack_cost = 23.5 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Ham';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Ham', 'g', 1000.0, 23.5
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Ham');

UPDATE stock_items SET pack_size = 1000.0, pack_cost = 24.95 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Pastrami';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Pastrami', 'g', 1000.0, 24.95
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Pastrami');

UPDATE stock_items SET pack_size = 1000.0, pack_cost = 25.95 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Roast Beef';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Roast Beef', 'g', 1000.0, 25.95
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Roast Beef');

UPDATE stock_items SET pack_size = 425.0, pack_cost = 4.5 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Tuna';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Tuna', 'g', 425.0, 4.5
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Tuna');

UPDATE stock_items SET pack_size = 1000.0, pack_cost = 22.95 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Turkey';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Turkey', 'g', 1000.0, 22.95
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Turkey');

UPDATE stock_items SET pack_size = 1000.0, pack_cost = 17.5 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Almonds';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Almonds', 'g', 1000.0, 17.5
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Almonds');

UPDATE stock_items SET pack_size = 1000.0, pack_cost = 13.21 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'American Cheese';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'American Cheese', 'g', 1000.0, 13.21
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'American Cheese');

UPDATE stock_items SET pack_size = 1000.0, pack_cost = 8.62 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'American Mustard';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'American Mustard', 'g', 1000.0, 8.62
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'American Mustard');

UPDATE stock_items SET pack_size = 1000.0, pack_cost = 30.9 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Brie';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Brie', 'g', 1000.0, 30.9
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Brie');

UPDATE stock_items SET pack_size = 2400.0, pack_cost = 25.0 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chilli Jam';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Chilli Jam', 'g', 2400.0, 25.0
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chilli Jam');

UPDATE stock_items SET pack_size = 1000.0, pack_cost = 16.14 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Coconut Flakes';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Coconut Flakes', 'g', 1000.0, 16.14
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Coconut Flakes');

UPDATE stock_items SET pack_size = 1000.0, pack_cost = 10.63 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Crispy Shallots';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Crispy Shallots', 'g', 1000.0, 10.63
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Crispy Shallots');

UPDATE stock_items SET pack_size = 1000.0, pack_cost = 10.38 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Cranberry Sauce';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Cranberry Sauce', 'g', 1000.0, 10.38
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Cranberry Sauce');

UPDATE stock_items SET pack_size = 1000.0, pack_cost = 8.12 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Dijon';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Dijon', 'g', 1000.0, 8.12
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Dijon');

UPDATE stock_items SET pack_size = 10800.0, pack_cost = 74.8 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Egg';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Egg', 'g', 10800.0, 74.8
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Egg');

UPDATE stock_items SET pack_size = 1000.0, pack_cost = 9.83 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Feta';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Feta', 'g', 1000.0, 9.83
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Feta');

UPDATE stock_items SET pack_size = 5000.0, pack_cost = 45.0 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Garlic Powder';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Garlic Powder', 'g', 5000.0, 45.0
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Garlic Powder');

UPDATE stock_items SET pack_size = 1000.0, pack_cost = 32.71 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Goji Berries';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Goji Berries', 'g', 1000.0, 32.71
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Goji Berries');

UPDATE stock_items SET pack_size = 1000.0, pack_cost = 15.0 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Granola';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Granola', 'g', 1000.0, 15.0
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Granola');

UPDATE stock_items SET pack_size = 2000.0, pack_cost = 15.57 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Greek Yoghurt';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Greek Yoghurt', 'g', 2000.0, 15.57
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Greek Yoghurt');

UPDATE stock_items SET pack_size = 1000.0, pack_cost = 8.09 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Honey';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Honey', 'g', 1000.0, 8.09
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Honey');

UPDATE stock_items SET pack_size = 1000.0, pack_cost = 14.36 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Horseradish';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Horseradish', 'g', 1000.0, 14.36
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Horseradish');

UPDATE stock_items SET pack_size = 3800.0, pack_cost = 31.0 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Jalapenos';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Jalapenos', 'g', 3800.0, 31.0
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Jalapenos');

UPDATE stock_items SET pack_size = 1000.0, pack_cost = 11.12 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Mango';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Mango', 'g', 1000.0, 11.12
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Mango');

UPDATE stock_items SET pack_size = 1000.0, pack_cost = 7.92 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Mayo';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Mayo', 'g', 1000.0, 7.92
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Mayo');

UPDATE stock_items SET pack_size = 4000.0, pack_cost = 49.0 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Olive Oil';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Olive Oil', 'g', 4000.0, 49.0
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Olive Oil');

UPDATE stock_items SET pack_size = 1000.0, pack_cost = 17.12 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Parmesan';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Parmesan', 'g', 1000.0, 17.12
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Parmesan');

UPDATE stock_items SET pack_size = 1000.0, pack_cost = 11.03 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Pepitas';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Pepitas', 'g', 1000.0, 11.03
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Pepitas');

UPDATE stock_items SET pack_size = 1000.0, pack_cost = 6.11 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Pickles';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Pickles', 'g', 1000.0, 6.11
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Pickles');

UPDATE stock_items SET pack_size = 1000.0, pack_cost = 11.41 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Quinoa';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Quinoa', 'g', 1000.0, 11.41
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Quinoa');

UPDATE stock_items SET pack_size = 2500.0, pack_cost = 15.68 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Sauerkraut';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Sauerkraut', 'g', 2500.0, 15.68
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Sauerkraut');

UPDATE stock_items SET pack_size = 1000.0, pack_cost = 8.03 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Seeded Mustard';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Seeded Mustard', 'g', 1000.0, 8.03
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Seeded Mustard');

UPDATE stock_items SET pack_size = 10000.0, pack_cost = 109.0 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Sundried Tomato';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Sundried Tomato', 'g', 10000.0, 109.0
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Sundried Tomato');

UPDATE stock_items SET pack_size = 1000.0, pack_cost = 17.0 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Swiss';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Swiss', 'g', 1000.0, 17.0
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Swiss');

UPDATE stock_items SET pack_size = 1000.0, pack_cost = 10.03 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Tomato Relish';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Tomato Relish', 'g', 1000.0, 10.03
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Tomato Relish');

UPDATE stock_items SET pack_size = 1000.0, pack_cost = 12.12 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Vegan Mayo';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Vegan Mayo', 'g', 1000.0, 12.12
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Vegan Mayo');

UPDATE stock_items SET pack_size = 150.0, pack_cost = 1.99 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Avocado';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Avocado', 'g', 150.0, 1.99
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Avocado');

UPDATE stock_items SET pack_size = 1000.0, pack_cost = 4.99 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Brown Onion';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Brown Onion', 'g', 1000.0, 4.99
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Brown Onion');

UPDATE stock_items SET pack_size = 800.0, pack_cost = 3.5 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Celery';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Celery', 'g', 800.0, 3.5
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Celery');

UPDATE stock_items SET pack_size = 3750.0, pack_cost = 34.8 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Cherry Tomato';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Cherry Tomato', 'g', 3750.0, 34.8
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Cherry Tomato');

UPDATE stock_items SET pack_size = 1000.0, pack_cost = 31.66 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chives';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Chives', 'g', 1000.0, 31.66
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chives');

UPDATE stock_items SET pack_size = 2600.0, pack_cost = 28.8 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Cos';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Cos', 'g', 2600.0, 28.8
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Cos');

UPDATE stock_items SET pack_size = 1000.0, pack_cost = 4.79 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Cucumber';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Cucumber', 'g', 1000.0, 4.79
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Cucumber');

UPDATE stock_items SET pack_size = 1000.0, pack_cost = 47.5 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Dill';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Dill', 'g', 1000.0, 47.5
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Dill');

UPDATE stock_items SET pack_size = 1000.0, pack_cost = 19.5 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Garlic';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Garlic', 'g', 1000.0, 19.5
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Garlic');

UPDATE stock_items SET pack_size = 220.0, pack_cost = 1.49 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Kale';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Kale', 'g', 220.0, 1.49
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Kale');

UPDATE stock_items SET pack_size = 1000.0, pack_cost = 14.99 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Mushrooms';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Mushrooms', 'g', 1000.0, 14.99
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Mushrooms');

UPDATE stock_items SET pack_size = 1000.0, pack_cost = 2.99 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Red Onion';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Red Onion', 'g', 1000.0, 2.99
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Red Onion');

UPDATE stock_items SET pack_size = 1000.0, pack_cost = 15.99 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Rocket';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Rocket', 'g', 1000.0, 15.99
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Rocket');

UPDATE stock_items SET pack_size = 250.0, pack_cost = 2.99 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Strawberries';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Strawberries', 'g', 250.0, 2.99
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Strawberries');

UPDATE stock_items SET pack_size = 1000.0, pack_cost = 3.69 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Sweet Potato';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Sweet Potato', 'g', 1000.0, 3.69
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Sweet Potato');

UPDATE stock_items SET pack_size = 30.0, pack_cost = 1.99 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Thyme';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Thyme', 'g', 30.0, 1.99
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Thyme');

UPDATE stock_items SET pack_size = 1000.0, pack_cost = 3.79 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Tomato';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Tomato', 'g', 1000.0, 3.79
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Tomato');

UPDATE stock_items SET pack_size = 1000.0, pack_cost = 2.94 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Salt';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Salt', 'g', 1000.0, 2.94
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Salt');

UPDATE stock_items SET pack_size = 2000.0, pack_cost = 25.0 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Pesto';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Pesto', 'g', 2000.0, 25.0
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Pesto');

UPDATE stock_items SET pack_size = 1000.0, pack_cost = 5.27 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Balsamic Vinegar';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Balsamic Vinegar', 'g', 1000.0, 5.27
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Balsamic Vinegar');

UPDATE stock_items SET pack_size = 5000.0, pack_cost = 10.42 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'White Wine Vinegar';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'White Wine Vinegar', 'g', 5000.0, 10.42
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'White Wine Vinegar');

UPDATE stock_items SET pack_size = 1000.0, pack_cost = 2.51 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'White Sugar';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'White Sugar', 'g', 1000.0, 2.51
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'White Sugar');

UPDATE stock_items SET pack_size = 1000.0, pack_cost = 18.89 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Curry Powder';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Curry Powder', 'g', 1000.0, 18.89
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Curry Powder');

UPDATE stock_items SET pack_size = 1000.0, pack_cost = 6.45 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Coconut Milk';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Coconut Milk', 'g', 1000.0, 6.45
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Coconut Milk');

UPDATE stock_items SET pack_size = 1000.0, pack_cost = 36.48 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Maple Syrup';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Maple Syrup', 'g', 1000.0, 36.48
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Maple Syrup');

UPDATE stock_items SET pack_size = 1000.0, pack_cost = 0.0 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Water';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Water', 'g', 1000.0, 0.0
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Water');

UPDATE stock_items SET pack_size = 1000.0, pack_cost = 2.75 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chickpea';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Chickpea', 'g', 1000.0, 2.75
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chickpea');

UPDATE stock_items SET pack_size = 1000.0, pack_cost = 14.63 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chia';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Chia', 'g', 1000.0, 14.63
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chia');

UPDATE stock_items SET pack_size = 2000.0, pack_cost = 30.0 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chilli Crisp';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Chilli Crisp', 'g', 2000.0, 30.0
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chilli Crisp');

UPDATE stock_items SET pack_size = NULL, pack_cost = NULL WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Bread (g)';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Bread (g)', 'g', NULL, NULL
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Bread (g)');

UPDATE stock_items SET pack_size = NULL, pack_cost = NULL WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Frozen Berries';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Frozen Berries', 'g', NULL, NULL
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Frozen Berries');

UPDATE stock_items SET pack_size = 1.0, pack_cost = 1.91 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Protein Ball (Bought In)';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Protein Ball (Bought In)', 'unit', 1.0, 1.91
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Protein Ball (Bought In)');

UPDATE stock_items SET pack_size = 1.0, pack_cost = 1.43 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Coca Cola (Bought In)';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Coca Cola (Bought In)', 'unit', 1.0, 1.43
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Coca Cola (Bought In)');

UPDATE stock_items SET pack_size = 1.0, pack_cost = 1.61 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Samboys (Bought In)';
INSERT INTO stock_items (org_id, name, uom, pack_size, pack_cost)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Samboys (Bought In)', 'unit', 1.0, 1.61
  WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Samboys (Bought In)');

-- ── 2. RECIPE COMPONENTS ───────────────────────────────────
-- 'Chilli Crisp' is deliberately excluded: the spreadsheet has
-- both a raw SKU and a component named identically, and the
-- component's own recipe was never filled in (stale $0 cost,
-- self-referential line) — every place that uses it clearly
-- means the raw SKU, so it's imported as SKU references only.

INSERT INTO recipe_components (org_id, name, type, uom, batch_yield)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Caesar Mayo', 'recipe', 'g', 2820.0
  WHERE NOT EXISTS (SELECT 1 FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Caesar Mayo');
INSERT INTO recipe_components (org_id, name, type, uom, batch_yield)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Caesar Dressing', 'recipe', 'g', 1000.0
  WHERE NOT EXISTS (SELECT 1 FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Caesar Dressing');
INSERT INTO recipe_components (org_id, name, type, uom, batch_yield)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Caramelised Onion', 'recipe', 'g', 1100.0
  WHERE NOT EXISTS (SELECT 1 FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Caramelised Onion');
INSERT INTO recipe_components (org_id, name, type, uom, batch_yield)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Chia', 'recipe', 'g', 1000.0
  WHERE NOT EXISTS (SELECT 1 FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chia');
INSERT INTO recipe_components (org_id, name, type, uom, batch_yield)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Chicken (Cooked)', 'prep', 'g', 700.0
  WHERE NOT EXISTS (SELECT 1 FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chicken (Cooked)');
INSERT INTO recipe_components (org_id, name, type, uom, batch_yield)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Chicken Avo Mix', 'recipe', 'g', 1200.0
  WHERE NOT EXISTS (SELECT 1 FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chicken Avo Mix');
INSERT INTO recipe_components (org_id, name, type, uom, batch_yield)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Chickpea Mix', 'recipe', 'g', 2000.0
  WHERE NOT EXISTS (SELECT 1 FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chickpea Mix');
INSERT INTO recipe_components (org_id, name, type, uom, batch_yield)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Chilli Mayo', 'recipe', 'g', 650.0
  WHERE NOT EXISTS (SELECT 1 FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chilli Mayo');
INSERT INTO recipe_components (org_id, name, type, uom, batch_yield)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Club Mix', 'recipe', 'g', 1200.0
  WHERE NOT EXISTS (SELECT 1 FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Club Mix');
INSERT INTO recipe_components (org_id, name, type, uom, batch_yield)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Compote', 'recipe', 'g', 800.0
  WHERE NOT EXISTS (SELECT 1 FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Compote');
INSERT INTO recipe_components (org_id, name, type, uom, batch_yield)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Croutons', 'recipe', 'g', 450.0
  WHERE NOT EXISTS (SELECT 1 FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Croutons');
INSERT INTO recipe_components (org_id, name, type, uom, batch_yield)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Curried Egg Mix', 'recipe', 'g', 2300.0
  WHERE NOT EXISTS (SELECT 1 FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Curried Egg Mix');
INSERT INTO recipe_components (org_id, name, type, uom, batch_yield)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Vinaigrette', 'recipe', 'g', 1000.0
  WHERE NOT EXISTS (SELECT 1 FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Vinaigrette');
INSERT INTO recipe_components (org_id, name, type, uom, batch_yield)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Horseradish Mayo', 'recipe', 'g', 1000.0
  WHERE NOT EXISTS (SELECT 1 FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Horseradish Mayo');
INSERT INTO recipe_components (org_id, name, type, uom, batch_yield)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Mushroom Mix', 'recipe', 'g', 1000.0
  WHERE NOT EXISTS (SELECT 1 FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Mushroom Mix');
INSERT INTO recipe_components (org_id, name, type, uom, batch_yield)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Mustard Mayo', 'recipe', 'g', 1000.0
  WHERE NOT EXISTS (SELECT 1 FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Mustard Mayo');
INSERT INTO recipe_components (org_id, name, type, uom, batch_yield)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Pesto Chicken Mix', 'recipe', 'g', 1200.0
  WHERE NOT EXISTS (SELECT 1 FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Pesto Chicken Mix');
INSERT INTO recipe_components (org_id, name, type, uom, batch_yield)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Pesto Sauce', 'recipe', 'g', 1650.0
  WHERE NOT EXISTS (SELECT 1 FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Pesto Sauce');
INSERT INTO recipe_components (org_id, name, type, uom, batch_yield)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Pesto Dressing', 'recipe', 'g', 1000.0
  WHERE NOT EXISTS (SELECT 1 FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Pesto Dressing');
INSERT INTO recipe_components (org_id, name, type, uom, batch_yield)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Pickled Onion', 'recipe', 'g', 1000.0
  WHERE NOT EXISTS (SELECT 1 FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Pickled Onion');
INSERT INTO recipe_components (org_id, name, type, uom, batch_yield)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Recess Seasoning', 'recipe', 'g', 1000.0
  WHERE NOT EXISTS (SELECT 1 FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Recess Seasoning');
INSERT INTO recipe_components (org_id, name, type, uom, batch_yield)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Truffle Mayo', 'recipe', 'g', 635.0
  WHERE NOT EXISTS (SELECT 1 FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Truffle Mayo');
INSERT INTO recipe_components (org_id, name, type, uom, batch_yield)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Tuna Mix', 'recipe', 'g', 4210.0
  WHERE NOT EXISTS (SELECT 1 FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Tuna Mix');
INSERT INTO recipe_components (org_id, name, type, uom, batch_yield)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Vegan Chilli Mayo', 'recipe', 'g', 1000.0
  WHERE NOT EXISTS (SELECT 1 FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Vegan Chilli Mayo');
INSERT INTO recipe_components (org_id, name, type, uom, batch_yield)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Zucc Pickles', 'recipe', 'g', 1000.0
  WHERE NOT EXISTS (SELECT 1 FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Zucc Pickles');

-- ── 3. RECIPE COMPONENT LINES ──────────────────────────────

INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Caesar Mayo'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Dijon'),
    960.0, 0;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Caesar Mayo'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Garlic Powder'),
    100.0, 1;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Caesar Mayo'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Mayo'),
    1440.0, 2;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Caesar Mayo'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Parmesan'),
    200.0, 3;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Caesar Mayo'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'White Wine Vinegar'),
    120.0, 4;

INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Caesar Dressing'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Dijon'),
    300.0, 0;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Caesar Dressing'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Garlic Powder'),
    110.0, 1;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Caesar Dressing'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Mayo'),
    2000.0, 2;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Caesar Dressing'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Parmesan'),
    300.0, 3;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Caesar Dressing'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'White Wine Vinegar'),
    240.0, 4;

INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Caramelised Onion'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Salt'),
    65.0, 0;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Caramelised Onion'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Brown Onion'),
    2000.0, 1;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Caramelised Onion'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Balsamic Vinegar'),
    400.0, 2;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Caramelised Onion'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'White Sugar'),
    200.0, 3;

INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chia'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Salt'),
    2.0, 0;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chia'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Coconut Milk'),
    1000.0, 1;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chia'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Maple Syrup'),
    83.0, 2;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chia'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Water'),
    333.0, 3;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chia'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chia'),
    189.0, 4;

INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chicken (Cooked)'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chicken (Raw)'),
    1000.0, 0;

INSERT INTO recipe_component_lines (org_id, component_id, sub_component_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chicken Avo Mix'),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chicken (Cooked)'),
    800.0, 0;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chicken Avo Mix'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Mayo'),
    240.0, 1;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chicken Avo Mix'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Seeded Mustard'),
    160.0, 2;

INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chickpea Mix'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Dijon'),
    123.0, 0;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chickpea Mix'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Garlic Powder'),
    30.0, 1;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chickpea Mix'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Salt'),
    2.0, 2;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chickpea Mix'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Vegan Mayo'),
    164.0, 3;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chickpea Mix'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Celery'),
    200.0, 4;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chickpea Mix'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chives'),
    40.0, 5;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chickpea Mix'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Dill'),
    40.0, 6;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chickpea Mix'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'White Wine Vinegar'),
    30.0, 7;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chickpea Mix'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chickpea'),
    1470.0, 8;

INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chilli Mayo'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Mayo'),
    500.0, 0;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chilli Mayo'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chilli Crisp'),
    150.0, 1;

INSERT INTO recipe_component_lines (org_id, component_id, sub_component_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Club Mix'),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chicken (Cooked)'),
    800.0, 0;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Club Mix'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Dijon'),
    136.0, 1;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Club Mix'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Garlic Powder'),
    14.0, 2;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Club Mix'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Mayo'),
    204.0, 3;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Club Mix'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Parmesan'),
    28.0, 4;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Club Mix'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'White Wine Vinegar'),
    18.0, 5;

INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Compote'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Frozen Berries'),
    1000.0, 0;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Compote'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'White Sugar'),
    200.0, 1;

INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Croutons'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Salt'),
    9.0, 0;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Croutons'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Olive Oil'),
    50.0, 1;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Croutons'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Bread (g)'),
    700.0, 2;

INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Curried Egg Mix'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Egg'),
    1660.0, 0;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Curried Egg Mix'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Salt'),
    5.0, 1;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Curried Egg Mix'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Mayo'),
    330.0, 2;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Curried Egg Mix'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Celery'),
    240.0, 3;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Curried Egg Mix'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Curry Powder'),
    60.0, 4;

INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Vinaigrette'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Honey'),
    50.0, 0;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Vinaigrette'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Seeded Mustard'),
    100.0, 1;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Vinaigrette'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Olive Oil'),
    700.0, 2;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Vinaigrette'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'White Wine Vinegar'),
    150.0, 3;

INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Horseradish Mayo'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Horseradish'),
    500.0, 0;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Horseradish Mayo'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Mayo'),
    500.0, 1;


INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Mustard Mayo'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Mayo'),
    600.0, 0;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Mustard Mayo'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Seeded Mustard'),
    400.0, 1;

INSERT INTO recipe_component_lines (org_id, component_id, sub_component_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Pesto Chicken Mix'),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chicken (Cooked)'),
    800.0, 0;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Pesto Chicken Mix'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Mayo'),
    90.0, 1;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Pesto Chicken Mix'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Parmesan'),
    50.0, 2;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Pesto Chicken Mix'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Pesto'),
    260.0, 3;

INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Pesto Sauce'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Mayo'),
    450.0, 0;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Pesto Sauce'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Parmesan'),
    200.0, 1;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Pesto Sauce'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Pesto'),
    1000.0, 2;

INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Pesto Dressing'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Mayo'),
    325.0, 0;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Pesto Dressing'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Parmesan'),
    49.0, 1;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Pesto Dressing'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Pesto'),
    325.0, 2;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Pesto Dressing'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Olive Oil'),
    163.0, 3;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Pesto Dressing'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'White Wine Vinegar'),
    122.0, 4;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Pesto Dressing'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'White Sugar'),
    16.0, 5;



INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Truffle Mayo'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Mayo'),
    600.0, 0;

INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Tuna Mix'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Tuna'),
    2880.0, 0;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Tuna Mix'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Dijon'),
    300.0, 1;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Tuna Mix'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Mayo'),
    550.0, 2;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Tuna Mix'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Celery'),
    350.0, 3;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Tuna Mix'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chives'),
    50.0, 4;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Tuna Mix'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Dill'),
    80.0, 5;

INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Vegan Chilli Mayo'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Vegan Mayo'),
    100.0, 0;
INSERT INTO recipe_component_lines (org_id, component_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Vegan Chilli Mayo'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chilli Crisp'),
    30.0, 1;


-- ── 4. MENU ITEM RECIPES ───────────────────────────────────
-- Category/price are UPDATEd onto an existing R-Prod item by
-- name where one already exists; otherwise a new item is
-- INSERTed. Two names are corrected to match R-Prod exactly:
-- 'The Big Tuna' -> 'Big Tuna', 'Egg & Mushroom Toastie' ->
-- 'Mushroom & Egg'.
--
-- Protein Ball / Coca Cola / Samboys are bought-in resale items
-- with no real recipe in the spreadsheet — each gets a single
-- recipe line against a pseudo '<Item> (Bought In)' SKU whose
-- pack cost equals the flat COGS the spreadsheet had for it.
--
-- 'Turkey, Brie & Cranberry' has a recipe but no sell price was
-- ever entered in the spreadsheet — sell_price is left NULL.

UPDATE production_items SET category = 'Sandwiches', sell_price = 14.6 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chicken Avo';
INSERT INTO production_items (org_id, name, category, color, sell_price)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Chicken Avo', 'Sandwiches', '#94A3B8', 14.6
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chicken Avo');

UPDATE production_items SET category = 'Sandwiches', sell_price = 14.6 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Ham, Cheese & Pickle';
INSERT INTO production_items (org_id, name, category, color, sell_price)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Ham, Cheese & Pickle', 'Sandwiches', '#94A3B8', 14.6
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Ham, Cheese & Pickle');

UPDATE production_items SET category = 'Sandwiches', sell_price = 14.6 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'BLT';
INSERT INTO production_items (org_id, name, category, color, sell_price)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'BLT', 'Sandwiches', '#94A3B8', 14.6
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'BLT');

UPDATE production_items SET category = 'Sandwiches', sell_price = 14.6 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chilli Turk';
INSERT INTO production_items (org_id, name, category, color, sell_price)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Chilli Turk', 'Sandwiches', '#94A3B8', 14.6
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chilli Turk');

UPDATE production_items SET category = 'Sandwiches', sell_price = 14.6 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Pastrami';
INSERT INTO production_items (org_id, name, category, color, sell_price)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Pastrami', 'Sandwiches', '#94A3B8', 14.6
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Pastrami');

UPDATE production_items SET category = 'Sandwiches', sell_price = 13.9 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Super Green';
INSERT INTO production_items (org_id, name, category, color, sell_price)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Super Green', 'Sandwiches', '#94A3B8', 13.9
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Super Green');

UPDATE production_items SET category = 'Sandwiches', sell_price = 13.9 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Curried Egg';
INSERT INTO production_items (org_id, name, category, color, sell_price)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Curried Egg', 'Sandwiches', '#94A3B8', 13.9
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Curried Egg');

UPDATE production_items SET category = 'Sandwiches', sell_price = 13.9 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Big Tuna';
INSERT INTO production_items (org_id, name, category, color, sell_price)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Big Tuna', 'Sandwiches', '#94A3B8', 13.9
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Big Tuna');

UPDATE production_items SET category = 'Sandwiches', sell_price = 14.9 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Recess Club';
INSERT INTO production_items (org_id, name, category, color, sell_price)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Recess Club', 'Sandwiches', '#94A3B8', 14.9
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Recess Club');

UPDATE production_items SET category = 'Sandwiches', sell_price = 13.9 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chickpea Smash';
INSERT INTO production_items (org_id, name, category, color, sell_price)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Chickpea Smash', 'Sandwiches', '#94A3B8', 13.9
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chickpea Smash');

UPDATE production_items SET category = 'Toasties', sell_price = 15.9 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Pesto Chook';
INSERT INTO production_items (org_id, name, category, color, sell_price)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Pesto Chook', 'Toasties', '#94A3B8', 15.9
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Pesto Chook');

UPDATE production_items SET category = 'Toasties', sell_price = 15.9 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'El Diablo';
INSERT INTO production_items (org_id, name, category, color, sell_price)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'El Diablo', 'Toasties', '#94A3B8', 15.9
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'El Diablo');

UPDATE production_items SET category = 'Toasties', sell_price = 15.9 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Tuna Melt';
INSERT INTO production_items (org_id, name, category, color, sell_price)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Tuna Melt', 'Toasties', '#94A3B8', 15.9
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Tuna Melt');

UPDATE production_items SET category = 'Toasties', sell_price = 14.9 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Roast Beef & Onion';
INSERT INTO production_items (org_id, name, category, color, sell_price)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Roast Beef & Onion', 'Toasties', '#94A3B8', 14.9
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Roast Beef & Onion');

UPDATE production_items SET category = 'Sandwiches', sell_price = NULL WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Turkey, Brie & Cranberry';
INSERT INTO production_items (org_id, name, category, color, sell_price)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Turkey, Brie & Cranberry', 'Sandwiches', '#94A3B8', NULL
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Turkey, Brie & Cranberry');

UPDATE production_items SET category = 'Toasties', sell_price = 12.9 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Tomato & Cheese';
INSERT INTO production_items (org_id, name, category, color, sell_price)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Tomato & Cheese', 'Toasties', '#94A3B8', 12.9
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Tomato & Cheese');

UPDATE production_items SET category = 'Toasties', sell_price = 9.9 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Cheese Toastie';
INSERT INTO production_items (org_id, name, category, color, sell_price)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Cheese Toastie', 'Toasties', '#94A3B8', 9.9
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Cheese Toastie');

UPDATE production_items SET category = 'Salads', sell_price = 16.9 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chicken & Greens';
INSERT INTO production_items (org_id, name, category, color, sell_price)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Chicken & Greens', 'Salads', '#94A3B8', 16.9
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chicken & Greens');

UPDATE production_items SET category = 'Salads', sell_price = 16.9 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chicken Caesar';
INSERT INTO production_items (org_id, name, category, color, sell_price)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Chicken Caesar', 'Salads', '#94A3B8', 16.9
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chicken Caesar');

UPDATE production_items SET category = 'Salads', sell_price = 15.9 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Veg & Grains';
INSERT INTO production_items (org_id, name, category, color, sell_price)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Veg & Grains', 'Salads', '#94A3B8', 15.9
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Veg & Grains');

UPDATE production_items SET category = 'Toasties', sell_price = 13.9 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'B&E Toastie';
INSERT INTO production_items (org_id, name, category, color, sell_price)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'B&E Toastie', 'Toasties', '#94A3B8', 13.9
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'B&E Toastie');

UPDATE production_items SET category = 'Toasties', sell_price = 13.9 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Mushroom & Egg';
INSERT INTO production_items (org_id, name, category, color, sell_price)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Mushroom & Egg', 'Toasties', '#94A3B8', 13.9
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Mushroom & Egg');

UPDATE production_items SET category = 'Breakfast', sell_price = 6.9 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Mango Chia Pudding';
INSERT INTO production_items (org_id, name, category, color, sell_price)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Mango Chia Pudding', 'Breakfast', '#F59E0B', 6.9
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Mango Chia Pudding');

UPDATE production_items SET category = 'Breakfast', sell_price = 5.9 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Yoghurt Cup';
INSERT INTO production_items (org_id, name, category, color, sell_price)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Yoghurt Cup', 'Breakfast', '#F59E0B', 5.9
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Yoghurt Cup');

UPDATE production_items SET category = 'Snacks', sell_price = 3.9 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Protein Ball';
INSERT INTO production_items (org_id, name, category, color, sell_price)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Protein Ball', 'Snacks', '#EC4899', 3.9
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Protein Ball');

UPDATE production_items SET category = 'Drinks', sell_price = 3.5 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Coca Cola';
INSERT INTO production_items (org_id, name, category, color, sell_price)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Coca Cola', 'Drinks', '#14B8A6', 3.5
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Coca Cola');

UPDATE production_items SET category = 'Snacks', sell_price = 3.5 WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Samboys';
INSERT INTO production_items (org_id, name, category, color, sell_price)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1), 'Samboys', 'Snacks', '#EC4899', 3.5
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Samboys');

-- ── 5. MENU ITEM RECIPE LINES ──────────────────────────────

INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chicken Avo'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Bread'),
    2.0, 0;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chicken Avo'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Butter'),
    10.0, 1;
INSERT INTO recipe_menu_item_lines (org_id, item_id, component_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chicken Avo'),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chicken Avo Mix'),
    120.0, 2;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chicken Avo'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Avocado'),
    45.0, 3;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chicken Avo'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chives'),
    1.0, 4;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chicken Avo'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Cos'),
    40.0, 5;

INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Ham, Cheese & Pickle'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Bread'),
    2.0, 0;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Ham, Cheese & Pickle'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Butter'),
    30.0, 1;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Ham, Cheese & Pickle'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Ham'),
    100.0, 2;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Ham, Cheese & Pickle'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Pickles'),
    20.0, 3;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Ham, Cheese & Pickle'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Swiss'),
    40.0, 4;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Ham, Cheese & Pickle'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Tomato Relish'),
    30.0, 5;

INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'BLT'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Bread'),
    2.0, 0;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'BLT'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Butter'),
    10.0, 1;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'BLT'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Bacon'),
    120.0, 2;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'BLT'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Mayo'),
    30.0, 3;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'BLT'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Cos'),
    40.0, 4;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'BLT'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Tomato'),
    45.0, 5;

INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chilli Turk'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Bread'),
    2.0, 0;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chilli Turk'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Butter'),
    10.0, 1;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chilli Turk'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Turkey'),
    100.0, 2;
INSERT INTO recipe_menu_item_lines (org_id, item_id, component_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chilli Turk'),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Caramelised Onion'),
    25.0, 3;
INSERT INTO recipe_menu_item_lines (org_id, item_id, component_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chilli Turk'),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chilli Mayo'),
    30.0, 4;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chilli Turk'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Rocket'),
    25.0, 5;

INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Pastrami'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Bread'),
    2.0, 0;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Pastrami'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Butter'),
    30.0, 1;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Pastrami'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Pastrami'),
    100.0, 2;
INSERT INTO recipe_menu_item_lines (org_id, item_id, component_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Pastrami'),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Mustard Mayo'),
    30.0, 3;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Pastrami'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Pickles'),
    20.0, 4;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Pastrami'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Sauerkraut'),
    20.0, 5;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Pastrami'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Swiss'),
    40.0, 6;

INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Super Green'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Bread'),
    2.0, 0;
INSERT INTO recipe_menu_item_lines (org_id, item_id, component_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Super Green'),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Pickled Onion'),
    20.0, 1;
INSERT INTO recipe_menu_item_lines (org_id, item_id, component_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Super Green'),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Recess Seasoning'),
    2.0, 2;
INSERT INTO recipe_menu_item_lines (org_id, item_id, component_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Super Green'),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Vegan Chilli Mayo'),
    30.0, 3;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Super Green'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Avocado'),
    45.0, 4;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Super Green'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Cucumber'),
    30.0, 5;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Super Green'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Dill'),
    2.0, 6;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Super Green'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Kale'),
    25.0, 7;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Super Green'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Rocket'),
    25.0, 8;

INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Curried Egg'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Bread'),
    2.0, 0;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Curried Egg'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Butter'),
    10.0, 1;
INSERT INTO recipe_menu_item_lines (org_id, item_id, component_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Curried Egg'),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Curried Egg Mix'),
    120.0, 2;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Curried Egg'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Cos'),
    40.0, 3;

INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Big Tuna'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Bread'),
    2.0, 0;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Big Tuna'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Butter'),
    10.0, 1;
INSERT INTO recipe_menu_item_lines (org_id, item_id, component_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Big Tuna'),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Tuna Mix'),
    120.0, 2;
INSERT INTO recipe_menu_item_lines (org_id, item_id, component_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Big Tuna'),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Zucc Pickles'),
    20.0, 3;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Big Tuna'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Cos'),
    40.0, 4;

INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Recess Club'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Bread'),
    2.0, 0;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Recess Club'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Butter'),
    10.0, 1;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Recess Club'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Bacon'),
    60.0, 2;
INSERT INTO recipe_menu_item_lines (org_id, item_id, component_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Recess Club'),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Club Mix'),
    120.0, 3;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Recess Club'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Pickles'),
    20.0, 4;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Recess Club'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Cos'),
    40.0, 5;

INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chickpea Smash'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Bread'),
    2.0, 0;
INSERT INTO recipe_menu_item_lines (org_id, item_id, component_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chickpea Smash'),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chickpea Mix'),
    120.0, 1;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chickpea Smash'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Crispy Shallots'),
    20.0, 2;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chickpea Smash'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Sundried Tomato'),
    25.0, 3;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chickpea Smash'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Vegan Mayo'),
    30.0, 4;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chickpea Smash'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Rocket'),
    25.0, 5;

INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Pesto Chook'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Bread'),
    2.0, 0;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Pesto Chook'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Butter'),
    30.0, 1;
INSERT INTO recipe_menu_item_lines (org_id, item_id, component_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Pesto Chook'),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Pesto Chicken Mix'),
    120.0, 2;
INSERT INTO recipe_menu_item_lines (org_id, item_id, component_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Pesto Chook'),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Zucc Pickles'),
    20.0, 3;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Pesto Chook'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Sundried Tomato'),
    25.0, 4;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Pesto Chook'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Swiss'),
    40.0, 5;

INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'El Diablo'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Bread'),
    2.0, 0;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'El Diablo'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Butter'),
    30.0, 1;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'El Diablo'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Ham'),
    50.0, 2;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'El Diablo'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Pastrami'),
    60.0, 3;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'El Diablo'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chilli Crisp'),
    20.0, 4;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'El Diablo'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Honey'),
    10.0, 5;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'El Diablo'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Jalapenos'),
    20.0, 6;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'El Diablo'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Swiss'),
    40.0, 7;

INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Tuna Melt'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Bread'),
    2.0, 0;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Tuna Melt'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Butter'),
    30.0, 1;
INSERT INTO recipe_menu_item_lines (org_id, item_id, component_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Tuna Melt'),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Recess Seasoning'),
    2.0, 2;
INSERT INTO recipe_menu_item_lines (org_id, item_id, component_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Tuna Melt'),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Tuna Mix'),
    120.0, 3;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Tuna Melt'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'American Cheese'),
    20.0, 4;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Tuna Melt'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'American Mustard'),
    20.0, 5;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Tuna Melt'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Pickles'),
    20.0, 6;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Tuna Melt'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Swiss'),
    20.0, 7;

INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Roast Beef & Onion'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Bread'),
    2.0, 0;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Roast Beef & Onion'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Butter'),
    30.0, 1;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Roast Beef & Onion'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Roast Beef'),
    100.0, 2;
INSERT INTO recipe_menu_item_lines (org_id, item_id, component_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Roast Beef & Onion'),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Caramelised Onion'),
    25.0, 3;
INSERT INTO recipe_menu_item_lines (org_id, item_id, component_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Roast Beef & Onion'),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Horseradish Mayo'),
    30.0, 4;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Roast Beef & Onion'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Swiss'),
    40.0, 5;

INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Turkey, Brie & Cranberry'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Bread'),
    2.0, 0;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Turkey, Brie & Cranberry'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Butter'),
    30.0, 1;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Turkey, Brie & Cranberry'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Turkey'),
    100.0, 2;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Turkey, Brie & Cranberry'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Brie'),
    45.0, 3;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Turkey, Brie & Cranberry'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Cranberry Sauce'),
    30.0, 4;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Turkey, Brie & Cranberry'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Swiss'),
    40.0, 5;

INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Tomato & Cheese'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Bread'),
    2.0, 0;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Tomato & Cheese'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Butter'),
    30.0, 1;
INSERT INTO recipe_menu_item_lines (org_id, item_id, component_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Tomato & Cheese'),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Recess Seasoning'),
    2.0, 2;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Tomato & Cheese'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Swiss'),
    40.0, 3;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Tomato & Cheese'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chives'),
    2.0, 4;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Tomato & Cheese'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Tomato'),
    45.0, 5;

INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Cheese Toastie'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Bread'),
    2.0, 0;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Cheese Toastie'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Butter'),
    30.0, 1;
INSERT INTO recipe_menu_item_lines (org_id, item_id, component_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Cheese Toastie'),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Recess Seasoning'),
    2.0, 2;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Cheese Toastie'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'American Cheese'),
    20.0, 3;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Cheese Toastie'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Swiss'),
    40.0, 4;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Cheese Toastie'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chives'),
    2.0, 5;

INSERT INTO recipe_menu_item_lines (org_id, item_id, component_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chicken & Greens'),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Pesto Chicken Mix'),
    90.0, 0;
INSERT INTO recipe_menu_item_lines (org_id, item_id, component_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chicken & Greens'),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Pesto Dressing'),
    60.0, 1;
INSERT INTO recipe_menu_item_lines (org_id, item_id, component_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chicken & Greens'),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Pickled Onion'),
    20.0, 2;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chicken & Greens'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Feta'),
    30.0, 3;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chicken & Greens'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Pepitas'),
    10.0, 4;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chicken & Greens'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Cherry Tomato'),
    80.0, 5;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chicken & Greens'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Cos'),
    45.0, 6;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chicken & Greens'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Cucumber'),
    60.0, 7;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chicken & Greens'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Dill'),
    5.0, 8;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chicken & Greens'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Rocket'),
    45.0, 9;

INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chicken Caesar'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Bacon'),
    60.0, 0;
INSERT INTO recipe_menu_item_lines (org_id, item_id, component_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chicken Caesar'),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Caesar Dressing'),
    60.0, 1;
INSERT INTO recipe_menu_item_lines (org_id, item_id, component_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chicken Caesar'),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Club Mix'),
    90.0, 2;
INSERT INTO recipe_menu_item_lines (org_id, item_id, component_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chicken Caesar'),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Croutons'),
    20.0, 3;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chicken Caesar'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Parmesan'),
    30.0, 4;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chicken Caesar'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chives'),
    2.0, 5;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chicken Caesar'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Cos'),
    90.0, 6;

INSERT INTO recipe_menu_item_lines (org_id, item_id, component_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Veg & Grains'),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Recess Seasoning'),
    3.0, 0;
INSERT INTO recipe_menu_item_lines (org_id, item_id, component_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Veg & Grains'),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Vinaigrette'),
    60.0, 1;
INSERT INTO recipe_menu_item_lines (org_id, item_id, component_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Veg & Grains'),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Zucc Pickles'),
    40.0, 2;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Veg & Grains'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Almonds'),
    25.0, 3;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Veg & Grains'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Quinoa'),
    50.0, 4;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Veg & Grains'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Swiss'),
    40.0, 5;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Veg & Grains'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Avocado'),
    90.0, 6;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Veg & Grains'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Kale'),
    45.0, 7;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Veg & Grains'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Rocket'),
    45.0, 8;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Veg & Grains'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Sweet Potato'),
    100.0, 9;

INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'B&E Toastie'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Bread'),
    2.0, 0;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'B&E Toastie'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Butter'),
    30.0, 1;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'B&E Toastie'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Bacon'),
    90.0, 2;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'B&E Toastie'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chilli Jam'),
    30.0, 3;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'B&E Toastie'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Egg'),
    80.0, 4;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'B&E Toastie'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Parmesan'),
    30.0, 5;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'B&E Toastie'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Swiss'),
    20.0, 6;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'B&E Toastie'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chives'),
    1.0, 7;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'B&E Toastie'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Cos'),
    3.0, 8;

INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Mushroom & Egg'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Bread'),
    2.0, 0;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Mushroom & Egg'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Butter'),
    30.0, 1;
INSERT INTO recipe_menu_item_lines (org_id, item_id, component_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Mushroom & Egg'),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Mushroom Mix'),
    90.0, 2;
INSERT INTO recipe_menu_item_lines (org_id, item_id, component_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Mushroom & Egg'),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Truffle Mayo'),
    30.0, 3;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Mushroom & Egg'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Egg'),
    80.0, 4;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Mushroom & Egg'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Parmesan'),
    30.0, 5;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Mushroom & Egg'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Swiss'),
    20.0, 6;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Mushroom & Egg'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chives'),
    1.0, 7;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Mushroom & Egg'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Cos'),
    3.0, 8;

INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Mango Chia Pudding'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Chia'),
    120.0, 0;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Mango Chia Pudding'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Coconut Flakes'),
    10.0, 1;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Mango Chia Pudding'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Goji Berries'),
    10.0, 2;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Mango Chia Pudding'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Granola'),
    20.0, 3;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Mango Chia Pudding'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Mango'),
    50.0, 4;

INSERT INTO recipe_menu_item_lines (org_id, item_id, component_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Yoghurt Cup'),
    (SELECT id FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Compote'),
    30.0, 0;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Yoghurt Cup'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Coconut Flakes'),
    10.0, 1;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Yoghurt Cup'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Granola'),
    30.0, 2;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Yoghurt Cup'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Greek Yoghurt'),
    120.0, 3;
INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Yoghurt Cup'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Strawberries'),
    20.0, 4;

INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Protein Ball'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Protein Ball (Bought In)'),
    1.0, 0;

INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Coca Cola'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Coca Cola (Bought In)'),
    1.0, 0;

INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1),
    (SELECT id FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Samboys'),
    (SELECT id FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Samboys (Bought In)'),
    1.0, 0;

-- ── VERIFY ──────────────────────────────────────────────────
-- Run these afterward to sanity-check the import (expect roughly
-- 74 SKUs w/ pricing, 25 components, 27 menu items):

-- SELECT count(*) FROM stock_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND pack_cost IS NOT NULL;
-- SELECT count(*) FROM recipe_components WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1);
-- SELECT count(*) FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND sell_price IS NOT NULL;
