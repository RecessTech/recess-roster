-- ============================================================
-- R-Recipe: add 4 ingredient lines missing vs. the sandwich build
-- guide (already applied directly to the live project via the
-- Supabase MCP -- this file just records the change for history).
--
-- Super Green was missing its sundried tomato strips, and Cheese
-- Toastie / Tomato & Cheese / Tuna Melt were all missing their pinch
-- of grated parmesan. Quantities: sundried tomato strips at 25g
-- matches the existing "5-6 pieces" convention already used for
-- Chickpea Smash and Pesto Chook; grated parmesan at 2g matches the
-- existing "1 pinch" convention already used for Recess Seasoning on
-- these same three items.
-- ============================================================

INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order)
SELECT o.id, pi.id, si.id, v.qty, v.sort_order
FROM (VALUES
  ('Super Green',     'Sundried Tomato Strips', 25, 9),
  ('Cheese Toastie',  'Grated Parmesan',         2, 6),
  ('Tomato & Cheese', 'Grated Parmesan',         2, 6),
  ('Tuna Melt',       'Grated Parmesan',         2, 8)
) AS v(item_name, stock_name, qty, sort_order)
JOIN organisations o ON o.name = 'It''s Recess'
JOIN production_items pi ON pi.org_id = o.id AND pi.name = v.item_name
JOIN stock_items si ON si.org_id = o.id AND si.name = v.stock_name
-- Safe to re-run: skip any pairing that's already been added.
WHERE NOT EXISTS (
  SELECT 1 FROM recipe_menu_item_lines ml
  WHERE ml.item_id = pi.id AND ml.stock_item_id = si.id
);
