-- ============================================================
-- R-Stock: remap 22 "wrong" SKUs onto their correct counterparts
-- ============================================================
-- For each (fix_name -> map_to_sku) pair: copies uom/pack_size/
-- pack_cost/units_per_carton from the "fix" row onto the "map to"
-- row (overwriting whatever the map-to row currently has), then
-- repoints every recipe_component_lines / recipe_menu_item_lines
-- row referencing the "fix" item onto the "map to" item instead
-- (dropping a repoint if it would create a duplicate ingredient
-- line in the same component/menu item).
--
-- Deliberately does NOT touch category or name on the "map to" row
-- -- only pricing/quantity/uom, per the brief.
--
-- Does NOT delete the "fix" rows -- run the VERIFY query below,
-- confirm it looks right, then run the separate DELETE script.
-- ============================================================

DO $$
DECLARE
  map RECORD;
  fix_id UUID;
  target_id UUID;
  ln RECORD;
BEGIN
  FOR map IN
    SELECT * FROM (VALUES
      ('Parmesan',        'SKU-0099'),
      ('Salt',             'SKU-0041'),
      ('Mushrooms',        'SKU-0154'),
      ('Pickles',          'SKU-0001'),
      ('Bacon',            'SKU-0092'),
      ('Cos',              'SKU-0077'),
      ('Sundried Tomato',  'SKU-0012'),
      ('Cherry Tomato',    'SKU-0071'),
      ('Avocado',          'SKU-0069'),
      ('Tomato Relish',    'SKU-0002'),
      ('Chia',             'SKU-0060'),
      ('Chickpea',         'SKU-0039'),
      ('Egg',              'SKU-0096'),
      ('Turkey',           'SKU-0095'),
      ('Almonds',          'SKU-0052'),
      ('Coconut Flakes',   'SKU-0037'),
      ('Crispy Shallots',  'SKU-0065'),
      ('Feta',             'SKU-0098'),
      ('Granola',          'SKU-0051'),
      ('Greek Yoghurt',    'SKU-0100'),
      ('Olive Oil',        'SKU-0047'),
      ('Chicken (Raw)',    'SKU-0090')
    ) AS t(fix_name, map_to_sku)
  LOOP
    SELECT id INTO fix_id FROM stock_items
      WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1)
        AND name = map.fix_name;
    SELECT id INTO target_id FROM stock_items
      WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1)
        AND sku = map.map_to_sku;

    IF fix_id IS NULL THEN
      RAISE NOTICE 'Skipped % -- no item with that name found', map.fix_name;
      CONTINUE;
    END IF;
    IF target_id IS NULL THEN
      RAISE NOTICE 'Skipped % -- map-to % not found', map.fix_name, map.map_to_sku;
      CONTINUE;
    END IF;
    IF fix_id = target_id THEN
      RAISE NOTICE 'Skipped % -- already the same row as %', map.fix_name, map.map_to_sku;
      CONTINUE;
    END IF;

    UPDATE stock_items t
    SET uom = f.uom,
        pack_size = f.pack_size,
        pack_cost = f.pack_cost,
        units_per_carton = f.units_per_carton
    FROM stock_items f
    WHERE t.id = target_id AND f.id = fix_id;

    FOR ln IN SELECT id, component_id FROM recipe_component_lines WHERE stock_item_id = fix_id LOOP
      IF EXISTS (SELECT 1 FROM recipe_component_lines WHERE component_id = ln.component_id AND stock_item_id = target_id) THEN
        DELETE FROM recipe_component_lines WHERE id = ln.id;
      ELSE
        UPDATE recipe_component_lines SET stock_item_id = target_id WHERE id = ln.id;
      END IF;
    END LOOP;

    FOR ln IN SELECT id, item_id FROM recipe_menu_item_lines WHERE stock_item_id = fix_id LOOP
      IF EXISTS (SELECT 1 FROM recipe_menu_item_lines WHERE item_id = ln.item_id AND stock_item_id = target_id) THEN
        DELETE FROM recipe_menu_item_lines WHERE id = ln.id;
      ELSE
        UPDATE recipe_menu_item_lines SET stock_item_id = target_id WHERE id = ln.id;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- ── VERIFY: fix row vs map-to row, side by side ──────────────────
-- Each pair should now show: 'fix' row still has its old data but
-- 0 recipe refs (all moved off it); 'map_to' row now carries the
-- fix row's uom/pack_size/pack_cost/units_per_carton and picked up
-- the recipe refs.
SELECT
  'fix' AS role, s.name, s.sku, s.category, s.uom, s.pack_size, s.pack_cost, s.cost_per_uom,
  (SELECT count(*) FROM recipe_component_lines WHERE stock_item_id = s.id) AS component_refs,
  (SELECT count(*) FROM recipe_menu_item_lines WHERE stock_item_id = s.id) AS menu_refs
FROM stock_items s
WHERE s.org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1)
  AND s.name IN ('Parmesan','Salt','Mushrooms','Pickles','Bacon','Cos','Sundried Tomato','Cherry Tomato',
                 'Avocado','Tomato Relish','Chia','Chickpea','Egg','Turkey','Almonds','Coconut Flakes',
                 'Crispy Shallots','Feta','Granola','Greek Yoghurt','Olive Oil','Chicken (Raw)')
UNION ALL
SELECT
  'map_to' AS role, s.name, s.sku, s.category, s.uom, s.pack_size, s.pack_cost, s.cost_per_uom,
  (SELECT count(*) FROM recipe_component_lines WHERE stock_item_id = s.id) AS component_refs,
  (SELECT count(*) FROM recipe_menu_item_lines WHERE stock_item_id = s.id) AS menu_refs
FROM stock_items s
WHERE s.org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1)
  AND s.sku IN ('SKU-0099','SKU-0041','SKU-0154','SKU-0001','SKU-0092','SKU-0077','SKU-0012','SKU-0071',
                'SKU-0069','SKU-0002','SKU-0060','SKU-0039','SKU-0096','SKU-0095','SKU-0052','SKU-0037',
                'SKU-0065','SKU-0098','SKU-0051','SKU-0100','SKU-0047','SKU-0090')
ORDER BY name, role;
