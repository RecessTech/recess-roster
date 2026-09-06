-- ============================================================
-- R-Recipe: per-item packaging lines
-- Run this in the R-Shift Supabase project SQL editor
-- ============================================================
-- Category-level packaging rules (category_packaging_lines) cover the
-- common case ("all Sandwiches get Tub/Lid/Napkin"), but some
-- categories -- Coffee & Tea being the concrete example -- need
-- packaging picked per item instead (a Flat White needs a cup + lid,
-- a Babyccino just a small cup). Rather than a new table, this reuses
-- recipe_menu_item_lines (already "any stock item, any qty, on one
-- item") and just tags which of an item's lines are packaging vs food
-- -- so R-Recipe's food-cost COGS/margin can keep excluding packaging
-- (per the earlier fix) while still tracking and forecasting it.

ALTER TABLE recipe_menu_item_lines
  ADD COLUMN IF NOT EXISTS is_packaging BOOLEAN NOT NULL DEFAULT false;
