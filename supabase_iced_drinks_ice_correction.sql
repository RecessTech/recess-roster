-- ============================================================
-- R-Recipe: Correct overstated Ice quantity in Iced drinks
-- Run this in the R-Shift Supabase project SQL editor
--
-- METHODOLOGY
-- -----------
-- Ice was originally modeled as literally filling half of a 420mL (14oz)
-- iced cup -- i.e. displacing 210mL of liquid. In practice, packed ice
-- doesn't displace 1:1 with its own volume (gaps between cubes), so the
-- real liquid displacement is closer to 120mL even though the ice still
-- visually fills about half the cup.
--
-- Freeing up that 90mL goes to whichever ingredient fills the rest of
-- the cup. For the milk + double-espresso (or milk + 60mL puree) base
-- drinks, that means: 410mL usable cup volume - 120mL ice - 60mL
-- espresso/puree = 230mL milk. (410mL, not the full 420mL cup, to leave
-- a small headspace below the rim/lid.) Iced Latte already had milk
-- manually set to 230 -- this migration brings its Ice line in line
-- with that, and applies the same correction everywhere else.
--
-- Items with no milk line yet (Iced Chai, Iced Chocolate, Iced Matcha,
-- Iced Milo, Iced Milo Mocha, Iced Mocha, Iced Strawberry, Iced
-- Strawberry Matcha) only get the Ice correction -- their full recipes
-- aren't built out yet, so there's no milk quantity to recompute.
-- ============================================================

UPDATE recipe_menu_item_lines rml
SET qty = 120
FROM production_items pi, stock_items si
WHERE rml.item_id = pi.id
  AND rml.stock_item_id = si.id
  AND pi.name ILIKE '%Iced%'
  AND si.name = 'Ice';

UPDATE recipe_menu_item_lines rml
SET qty = 230
FROM production_items pi, stock_items si
WHERE rml.item_id = pi.id
  AND rml.stock_item_id = si.id
  AND pi.name IN ('Banana Iced Latte', 'Iced Banana', 'Iced Latte')
  AND si.name = 'Full Cream Milk';

-- ── VERIFY ─────────────────────────────────────────────────────
SELECT pi.name AS menu_item, si.name AS ingredient, rml.qty
FROM recipe_menu_item_lines rml
JOIN production_items pi ON pi.id = rml.item_id
JOIN stock_items si ON si.id = rml.stock_item_id
WHERE pi.name ILIKE '%Iced%' AND si.name IN ('Ice', 'Full Cream Milk')
ORDER BY pi.name, si.name;
