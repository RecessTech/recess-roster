-- ============================================================
-- Correct pack_size for tray/box SKUs, computed from researched
-- standard AU food-service pack composition (not from an invoice --
-- worth spot-checking against your actual supplier next delivery).
-- pack_cost is untouched; cost_per_uom (generated) recalculates
-- automatically from the corrected pack_size.
--
--   Baby Cos Gem (SKU-0077): 12 heads/box x ~80g/head  = 960g
--   Cherry Toms  (SKU-0071): 12 punnets/tray x 250g    = 3000g
--   Eggs         (SKU-0096): 15 dozen (180) x ~52g/egg = 9360g
--
-- NOT included: Avos (SKU-0069) -- tray count/weight varies too much
-- by size grading to guess responsibly; waiting on an actual invoice
-- figure.
--
-- Note: reference_order_qty for these SKUs is NOT adjusted here --
-- that's a "how many boxes do we order" business call, separate from
-- "what does a box physically contain". The ratio of order-qty to
-- pack-size will look different once this runs; revisit it in the
-- front end if the resulting order-in-packs number looks off.
-- ============================================================

UPDATE stock_items SET pack_size = 960, updated_at = now()
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND sku = 'SKU-0077';

UPDATE stock_items SET pack_size = 3000, updated_at = now()
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND sku = 'SKU-0071';

UPDATE stock_items SET pack_size = 9360, updated_at = now()
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND sku = 'SKU-0096';

-- ── VERIFY ─────────────────────────────────────────────────────
SELECT sku, name, uom, pack_size, pack_cost, cost_per_uom
FROM stock_items
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1)
  AND sku IN ('SKU-0077', 'SKU-0071', 'SKU-0096')
ORDER BY sku;
