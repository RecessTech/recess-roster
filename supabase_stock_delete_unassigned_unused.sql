-- ============================================================
-- R-Stock: delete unassigned items that aren't used in any recipe
-- ============================================================
-- Targets stock_items with no site assignment (never shown in
-- Stocktake/Ordering) AND no recipe reference (not used to cost any
-- component or menu item). Anything used in a recipe is left alone,
-- even if unassigned to a site -- deleting it would break that
-- recipe's COGS.
--
-- Run the PREVIEW first, check the list, then run the DELETE.
-- ============================================================

-- ── PREVIEW: what will be deleted ────────────────────────────────
SELECT s.id, s.name, s.category, s.pack_size, s.pack_cost
FROM stock_items s
WHERE s.org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM stock_item_sites x WHERE x.item_id = s.id)
  AND NOT EXISTS (SELECT 1 FROM recipe_component_lines l WHERE l.stock_item_id = s.id)
  AND NOT EXISTS (SELECT 1 FROM recipe_menu_item_lines l WHERE l.stock_item_id = s.id)
ORDER BY s.name;

-- ── PREVIEW: unassigned items that will be KEPT because a recipe
-- uses them, with what uses them ────────────────────────────────
SELECT
  s.name,
  s.id,
  (SELECT count(*) FROM recipe_component_lines l WHERE l.stock_item_id = s.id) AS used_in_components,
  (SELECT count(*) FROM recipe_menu_item_lines l WHERE l.stock_item_id = s.id) AS used_in_menu_items
FROM stock_items s
WHERE s.org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM stock_item_sites x WHERE x.item_id = s.id)
  AND (
    EXISTS (SELECT 1 FROM recipe_component_lines l WHERE l.stock_item_id = s.id)
    OR EXISTS (SELECT 1 FROM recipe_menu_item_lines l WHERE l.stock_item_id = s.id)
  )
ORDER BY s.name;

-- ── DELETE: run once you're happy with the preview above ─────────
DELETE FROM stock_items s
WHERE s.org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM stock_item_sites x WHERE x.item_id = s.id)
  AND NOT EXISTS (SELECT 1 FROM recipe_component_lines l WHERE l.stock_item_id = s.id)
  AND NOT EXISTS (SELECT 1 FROM recipe_menu_item_lines l WHERE l.stock_item_id = s.id);
