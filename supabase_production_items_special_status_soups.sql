-- ============================================================
-- Flag all Soups as special/no-longer-on-the-menu now that the
-- final week of soup service has concluded. Excludes them from
-- R-Crystal-Ball forecasting and R-Prod planning until soup season
-- returns (flip is_special back to false in R-Recipe when it does).
-- ============================================================

UPDATE production_items
SET is_special = true
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1)
  AND category = 'Soups';

-- ── VERIFY ─────────────────────────────────────────────────────
SELECT name, category, is_special
FROM production_items
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1)
  AND category = 'Soups'
ORDER BY name;
