-- ============================================================
-- Olive Oil - Extra Virgin (SKU-0047) should be tracked by volume
-- (ml), not weight (g) -- it's a liquid. Same pattern as every other
-- unit fix in this series: the existing numbers already describe the
-- right scale (a 4000ml / 4L bottle for the recorded pack_cost, a
-- 4000ml reorder qty), only the label is wrong -- so this is just a
-- relabel, no numeric change.
-- ============================================================

UPDATE stock_items
SET uom = 'ml', updated_at = now()
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1)
  AND sku = 'SKU-0047';

-- ── VERIFY ─────────────────────────────────────────────────────
SELECT sku, name, uom, pack_size, pack_cost, cost_per_uom
FROM stock_items
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1)
  AND sku = 'SKU-0047';
