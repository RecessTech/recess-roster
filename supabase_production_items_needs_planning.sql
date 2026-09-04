-- ============================================================
-- Add "needs production planning" flag to production_items.
-- Controlled from R-Recipe (Menu Recipes tab); R-Prod (planner +
-- Insights) hides any item where this is false. Defaults to true so
-- nothing disappears until explicitly turned off.
-- ============================================================

ALTER TABLE production_items
  ADD COLUMN IF NOT EXISTS needs_prod_planning BOOLEAN NOT NULL DEFAULT true;

-- Made to order (coffee) or shelf stock (drinks, bakery, snacks) --
-- doesn't need a batch-prep plan in R-Prod.
UPDATE production_items
SET needs_prod_planning = false
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1)
  AND category IN ('Coffee & Tea', 'Drinks', 'Bakery', 'Snacks');

-- Breakfast: best-guess split -- Toast and Yoghurt Cup read as
-- made-to-order/assembled, the rest (B&E Toastie, Mushroom & Egg,
-- Mango Chia Pudding) as batch-prepped. Flip any of these in R-Recipe
-- if this guess is wrong -- cheap to fix, not worth blocking on.
UPDATE production_items
SET needs_prod_planning = false
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1)
  AND name IN ('Toast', 'Yoghurt Cup');

-- Sandwiches / Toasties / Salads / Soups / everything else keep the
-- true default.

-- ── VERIFY ─────────────────────────────────────────────────────
SELECT category, needs_prod_planning, count(*) AS n, string_agg(name, ', ' ORDER BY name) AS items
FROM production_items
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1)
GROUP BY category, needs_prod_planning
ORDER BY category, needs_prod_planning;
