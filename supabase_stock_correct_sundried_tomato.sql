-- ============================================================
-- Business correction (not a unit bug -- already correctly scaled,
-- the standard order size itself was wrong): Sundried Tomato Strips
-- 1kg -> 5kg per order. Same pattern as
-- supabase_stock_correct_order_sizes.sql -- exact value, not a
-- multiplier, so safe to re-run.
-- ============================================================

DO $$
DECLARE
  v_org_id UUID := (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1);
BEGIN
  UPDATE stock_item_sites sis SET reference_order_qty = 5000, updated_at = now()
  FROM stock_items si WHERE sis.item_id = si.id AND si.org_id = v_org_id AND si.sku = 'SKU-0012' AND sis.reference_order_qty = 1000;

  UPDATE stock_order_history soh SET order_qty = 5000
  FROM stock_items si WHERE soh.item_id = si.id AND si.org_id = v_org_id AND si.sku = 'SKU-0012' AND soh.order_qty = 1000;
END $$;

-- ── VERIFY ─────────────────────────────────────────────────────
SELECT si.sku, si.name, sis.reference_order_qty
FROM stock_items si JOIN stock_item_sites sis ON sis.item_id = si.id
WHERE si.org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND si.sku = 'SKU-0012';

SELECT si.sku, si.name, soh.order_qty, soh.ordered_date
FROM stock_order_history soh JOIN stock_items si ON si.id = soh.item_id
WHERE si.org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND si.sku = 'SKU-0012'
ORDER BY soh.ordered_date;
