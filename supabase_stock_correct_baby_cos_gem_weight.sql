-- ============================================================
-- Baby Cos Gem (SKU-0077): pack_size corrected from 1920g to 2238g.
--
-- Not a unit-mislabel fix like the previous batch -- uom/order_pack_label
-- were already right (g / box). This corrects the box-weight ESTIMATE
-- itself, which the user flagged as making the app's box-count math look
-- overstated (a too-small assumed box weight inflates grams-needed /
-- pack_size into more boxes than reality).
--
-- Derived from real sales history (8.9 weeks, 2026-07-06 to 2026-09-05)
-- expanded through every recipe line using Baby Cos Gem, giving ~12,310g/
-- week of actual consumption, divided by the user's own estimate of
-- 5-6 boxes/week (midpoint 5.5) = ~2238g/box (~93g/head across 24 heads,
-- a normal weight for a small cos head -- more plausible than the old
-- 80g/head assumption).
--
-- Only pack_size changes. reference_order_qty/order_qty are a separate
-- "how many boxes do we order" business call, not derived from box
-- weight, so left untouched -- same reasoning as the original tray-fix
-- pass. cost_per_uom (generated) recalculates automatically and will
-- drop slightly, since the same box price now covers more usable
-- product than previously modeled.
-- ============================================================

UPDATE stock_items SET pack_size = 2238, updated_at = now()
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND sku = 'SKU-0077';

-- ── VERIFY ─────────────────────────────────────────────────────
SELECT si.sku, si.name, si.uom, si.pack_size, si.pack_cost, si.cost_per_uom, si.order_pack_label,
       sis.reference_order_qty,
       round((sis.reference_order_qty / si.pack_size)::numeric, 2) AS order_qty_in_boxes
FROM stock_items si
JOIN stock_item_sites sis ON sis.item_id = si.id
WHERE si.org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND si.sku = 'SKU-0077';
