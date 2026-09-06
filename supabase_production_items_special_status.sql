-- ============================================================
-- Add "special / no longer on menu" flag to production_items.
-- Controlled from R-Recipe (Menu Recipes tab), same as
-- needs_prod_planning. Items flagged this way are limited-time or
-- discontinued -- they should not be forecast (R-Crystal-Ball) or
-- planned for production (R-Prod). Defaults to false so nothing
-- currently on the menu disappears until explicitly flagged.
-- ============================================================

ALTER TABLE production_items
  ADD COLUMN IF NOT EXISTS is_special BOOLEAN NOT NULL DEFAULT false;

-- Limited-time-only item that's since come off the menu -- keep the
-- row (past sales history still references it) but stop it showing
-- up in forecasts or production planning.
UPDATE production_items
SET is_special = true
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1)
  AND name = 'Birria Toastie';

-- ── VERIFY ─────────────────────────────────────────────────────
SELECT name, category, is_special
FROM production_items
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1)
ORDER BY is_special DESC, category, name;
