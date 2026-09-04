-- ============================================================
-- Rename "Big Tuna" -> "The Big Tuna" and merge the Crystal-Ball-
-- created duplicate into it (repoints sales_history and any recipe
-- lines before deleting the duplicate, so nothing is lost).
-- ============================================================

DO $$
DECLARE
  real_id UUID;
  dupe_id UUID;
BEGIN
  SELECT id INTO real_id FROM production_items
    WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Big Tuna';
  SELECT id INTO dupe_id FROM production_items
    WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'The Big Tuna';

  IF real_id IS NULL THEN
    RAISE NOTICE 'No item named "Big Tuna" found -- nothing to rename';
    RETURN;
  END IF;

  UPDATE production_items SET name = 'The Big Tuna' WHERE id = real_id;

  IF dupe_id IS NOT NULL AND dupe_id <> real_id THEN
    -- Repoint sales_history, skipping any date that would collide
    UPDATE sales_history SET item_id = real_id
    WHERE item_id = dupe_id
      AND NOT EXISTS (
        SELECT 1 FROM sales_history sh2
        WHERE sh2.item_id = real_id AND sh2.sale_date = sales_history.sale_date AND sh2.channel = sales_history.channel
      );
    DELETE FROM sales_history WHERE item_id = dupe_id; -- any leftover (colliding) rows

    -- Repoint recipe lines, in case the duplicate picked any up
    UPDATE recipe_menu_item_lines SET item_id = real_id WHERE item_id = dupe_id;

    DELETE FROM production_items WHERE id = dupe_id;
    RAISE NOTICE 'Merged duplicate "The Big Tuna" into the real item and deleted it';
  END IF;
END $$;

-- ── VERIFY ─────────────────────────────────────────────────────
SELECT name, count(*) FROM production_items
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1)
  AND name IN ('Big Tuna', 'The Big Tuna')
GROUP BY name;

SELECT count(*) AS sales_rows_for_the_big_tuna
FROM sales_history sh
JOIN production_items p ON p.id = sh.item_id
WHERE p.org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND p.name = 'The Big Tuna';
