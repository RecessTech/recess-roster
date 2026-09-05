-- ============================================================
-- Baby Cos Gem (SKU-0077): pack_size corrected again, this time from a
-- real physical composition instead of a consumption-derived estimate.
--
-- Box = 12 packs x 2 heads x 200g/head = 4800g.
--
-- Supersedes the previous 2238g estimate (supabase_stock_correct_baby_cos_gem_weight.sql),
-- which was back-derived from POS-only weekly consumption divided by
-- "5-6 boxes/week" -- that undercounted real demand (delivery apps and
-- Classpass also sell dishes using this SKU, and both ADD to true
-- total demand rather than being folded into one blended average), so
-- the resulting pack_size was too small. This number instead comes
-- straight from box composition, so it isn't sensitive to which sales
-- channels happen to be counted or how the forecast trend behaves.
--
-- Only pack_size changes. reference_order_qty/order_qty are a separate
-- "how many boxes to order" business call, not derived from box
-- weight. cost_per_uom (generated) recalculates automatically.
-- order_qty_in_boxes on order history and Crystal Ball's Week Ahead
-- both read this same pack_size directly -- nothing else to fix.
-- ============================================================

UPDATE stock_items SET pack_size = 4800, updated_at = now()
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND sku = 'SKU-0077';

-- ── VERIFY ─────────────────────────────────────────────────────
SELECT si.sku, si.name, si.uom, si.pack_size, si.pack_cost, si.cost_per_uom, si.order_pack_label,
       sis.reference_order_qty,
       round((sis.reference_order_qty / si.pack_size)::numeric, 2) AS reference_in_boxes,
       round((sis.order_qty / si.pack_size)::numeric, 2) AS order_qty_in_boxes
FROM stock_items si
JOIN stock_item_sites sis ON sis.item_id = si.id
WHERE si.org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND si.sku = 'SKU-0077';
