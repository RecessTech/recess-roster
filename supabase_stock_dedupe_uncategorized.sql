-- ============================================================
-- R-Stock: merge duplicate items created by the R-Recipe import
-- ============================================================
-- The R-Recipe seed import created a new stock_items row for any
-- ingredient name it couldn't find an exact match for -- these came
-- in with pricing (pack_size/pack_cost) but no category and no site
-- assignment, sitting alongside the "real" catalog item of the same
-- name that Stocktake/Ordering actually use. This merges the two:
--   1. Carries pack_size/pack_cost onto the real (categorized) item
--      if it doesn't already have its own pricing.
--   2. Repoints any recipe_component_lines / recipe_menu_item_lines
--      that reference the uncategorized duplicate onto the real item
--      (skipping a repoint if that would create a second line for
--      the same ingredient in the same component/menu item -- the
--      redundant line is dropped instead).
--   3. Deletes the now-unreferenced uncategorized duplicate.
-- An uncategorized item with no same-name categorized twin is left
-- alone -- there's nothing to merge it into.
--
-- Run the two PREVIEW queries first to see what this will do before
-- running the MERGE block.
-- ============================================================

-- ── PREVIEW 1: duplicates that will be merged & removed ─────────
SELECT
  u.name,
  u.id   AS uncategorized_id,
  t.id   AS keeper_id,
  t.category,
  (SELECT count(*) FROM recipe_component_lines WHERE stock_item_id = u.id) AS component_line_refs,
  (SELECT count(*) FROM recipe_menu_item_lines WHERE stock_item_id = u.id) AS menu_line_refs
FROM stock_items u
JOIN stock_items t
  ON t.org_id = u.org_id
  AND t.id <> u.id
  AND t.category IS NOT NULL AND t.category <> ''
  AND lower(trim(t.name)) = lower(trim(u.name))
WHERE u.org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1)
  AND (u.category IS NULL OR u.category = '')
ORDER BY u.name;

-- ── PREVIEW 2: uncategorized items with no twin -- left alone ───
SELECT id, name, pack_size, pack_cost
FROM stock_items s
WHERE s.org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1)
  AND (s.category IS NULL OR s.category = '')
  AND NOT EXISTS (
    SELECT 1 FROM stock_items t
    WHERE t.org_id = s.org_id AND t.id <> s.id
      AND t.category IS NOT NULL AND t.category <> ''
      AND lower(trim(t.name)) = lower(trim(s.name))
  )
ORDER BY s.name;

-- ── MERGE: run once you're happy with the preview above ─────────
DO $$
DECLARE
  r RECORD;
  target_id UUID;
  ln RECORD;
BEGIN
  FOR r IN
    SELECT id, org_id, name, pack_size, pack_cost
    FROM stock_items
    WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1)
      AND (category IS NULL OR category = '')
  LOOP
    SELECT id INTO target_id
    FROM stock_items
    WHERE org_id = r.org_id
      AND id <> r.id
      AND category IS NOT NULL AND category <> ''
      AND lower(trim(name)) = lower(trim(r.name))
    LIMIT 1;

    IF target_id IS NULL THEN
      CONTINUE; -- no categorized twin -- leave it for now
    END IF;

    UPDATE stock_items
    SET pack_size = COALESCE(pack_size, r.pack_size),
        pack_cost = COALESCE(pack_cost, r.pack_cost)
    WHERE id = target_id AND (pack_size IS NULL OR pack_cost IS NULL);

    FOR ln IN SELECT id, component_id FROM recipe_component_lines WHERE stock_item_id = r.id LOOP
      IF EXISTS (SELECT 1 FROM recipe_component_lines WHERE component_id = ln.component_id AND stock_item_id = target_id) THEN
        DELETE FROM recipe_component_lines WHERE id = ln.id;
      ELSE
        UPDATE recipe_component_lines SET stock_item_id = target_id WHERE id = ln.id;
      END IF;
    END LOOP;

    FOR ln IN SELECT id, item_id FROM recipe_menu_item_lines WHERE stock_item_id = r.id LOOP
      IF EXISTS (SELECT 1 FROM recipe_menu_item_lines WHERE item_id = ln.item_id AND stock_item_id = target_id) THEN
        DELETE FROM recipe_menu_item_lines WHERE id = ln.id;
      ELSE
        UPDATE recipe_menu_item_lines SET stock_item_id = target_id WHERE id = ln.id;
      END IF;
    END LOOP;

    DELETE FROM stock_items WHERE id = r.id;
  END LOOP;
END $$;

-- ── VERIFY: what's left uncategorized (should just be genuinely
-- new items with no existing twin -- fine to leave for recipes) ──
SELECT id, name, pack_size, pack_cost
FROM stock_items
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1)
  AND (category IS NULL OR category = '')
ORDER BY name;
