-- ============================================================
-- R-Recipe: fill in packaging for Coffee & Tea items and TGTG bag
-- ============================================================
-- The Coffee & Tea category has no category-level packaging rule (each
-- drink's packaging is picked per-item instead -- see RecipesApp.jsx's
-- MenuItemBuilderModal comment). Espresso, Macchiato and Magic had never
-- had theirs set, so they silently costed $0 packaging -- found while
-- building the real packaging accrual (packagingAccrual.js), which
-- surfaced every active item with neither a category rule nor an item
-- line as a genuine gap vs. a legitimately-unpackaged item (e.g. a
-- pre-packaged retail drink).
--
-- User-confirmed compositions:
--   Espresso   = 4oz cup + 4oz lid
--   Macchiato  = 4oz cup + 4oz lid
--   Magic      = 6oz cup + 8oz lid
--   TGTG Surprise Bag = 1 carry bag
-- Protein Add-On confirmed as genuinely packaging-free -- left untouched.

INSERT INTO recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order, is_packaging)
SELECT pi.org_id, pi.id, si.id, v.qty, v.sort_order, true
FROM (VALUES
  ('Espresso',          'Piccolo Coffee Cups (4oz)', 1, 0),
  ('Espresso',          '4oz Coffee Lid',            1, 1),
  ('Macchiato',         'Piccolo Coffee Cups (4oz)', 1, 0),
  ('Macchiato',         '4oz Coffee Lid',             1, 1),
  ('Magic',             'Small Coffee Cups (6oz)',    1, 0),
  ('Magic',             '8oz Coffee Lid',             1, 1),
  ('TGTG Surprise Bag', 'Carry Bags',                 1, 0)
) AS v(item_name, packaging_name, qty, sort_order)
JOIN production_items pi ON pi.name = v.item_name
JOIN stock_items si ON si.name = v.packaging_name;

-- ── VERIFY ─────────────────────────────────────────────────────
SELECT pi.name AS item, si.name AS packaging, l.qty
FROM recipe_menu_item_lines l
JOIN production_items pi ON pi.id = l.item_id
JOIN stock_items si ON si.id = l.stock_item_id
WHERE l.is_packaging AND pi.name IN ('Espresso','Macchiato','Magic','TGTG Surprise Bag')
ORDER BY pi.name;
