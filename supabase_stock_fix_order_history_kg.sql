-- ============================================================
-- Fix: stock_order_history.order_qty for the 55 SKUs relabelled
-- kg -> g (supabase_stock_fix_kg_mislabel.sql).
--
-- Gap in the original fix: stock_order_history doesn't store its own
-- unit -- it's archived from stock_item_sites.order_qty by the
-- nightly archive_and_reset_stock_orders() function, and the R-Stock
-- Insights tab displays it grouped by the item's CURRENT uom. Every
-- row archived before the uom fix ran was a kg-scale number typed by
-- a human (e.g. Butter order_qty=8, meaning 8kg) -- now displayed
-- under 'g', those look like "8 g" instead of "8 kg".
--
-- Confirmed via diagnostic: every existing stock_order_history row
-- for these SKUs has created_at before the uom fix's updated_at, so
-- this scales cleanly. The created_at < si.updated_at condition is
-- kept as a safety guard rather than relied on as an assumption --
-- any row archived AFTER the uom fix (already correctly gram-scale)
-- is excluded automatically, so this is safe to re-run.
-- ============================================================

DO $$
DECLARE
  v_org_id UUID := (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1);
  v_count INT;
BEGIN
  UPDATE stock_order_history soh
  SET order_qty = soh.order_qty * 1000
  FROM stock_items si
  WHERE soh.item_id = si.id
    AND si.org_id = v_org_id
    AND si.uom = 'g'
    AND si.sku IN (
      'SKU-0085','SKU-0004','SKU-0104','SKU-0003','SKU-0006','SKU-0016','SKU-0007','SKU-0048',
      'SKU-0009','SKU-0033','SKU-0088','SKU-0093','SKU-0094','SKU-0072','SKU-0034','SKU-0059',
      'SKU-0036','SKU-0070','SKU-0097','SKU-0008','SKU-0101','SKU-0005','SKU-0013','SKU-0011',
      'SKU-0102','SKU-0035','SKU-0061','SKU-0075','SKU-0074','SKU-0084','SKU-0083','SKU-0017',
      'SKU-0127','SKU-0131','SKU-0049','SKU-0067','SKU-0010','SKU-0068','SKU-0015','SKU-0136',
      'SKU-0118','SKU-0058','SKU-0087','SKU-0014','SKU-0066','SKU-0134','SKU-0157','SKU-0169',
      'SKU-0135','SKU-0130','SKU-0133','SKU-0018','SKU-0161','SKU-0170','SKU-0132','SKU-0042'
    )
    AND soh.order_qty IS NOT NULL
    AND soh.created_at < si.updated_at;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Scaled % stock_order_history rows from kg to g', v_count;
END $$;

-- ── VERIFY ─────────────────────────────────────────────────────
-- order_qty should now be in the thousands, matching the pattern
-- from the live reference_order_qty fix (e.g. Butter 8 -> 8000).
SELECT si.sku, si.name, soh.order_qty, soh.ordered_date, soh.created_at
FROM stock_order_history soh
JOIN stock_items si ON si.id = soh.item_id
WHERE si.org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1)
  AND si.sku IN (
    'SKU-0085','SKU-0004','SKU-0104','SKU-0003','SKU-0006','SKU-0016','SKU-0007','SKU-0048',
    'SKU-0009','SKU-0033','SKU-0088','SKU-0093','SKU-0094','SKU-0072','SKU-0034','SKU-0059',
    'SKU-0036','SKU-0070','SKU-0097','SKU-0008','SKU-0101','SKU-0005','SKU-0013','SKU-0011',
    'SKU-0102','SKU-0035','SKU-0061','SKU-0075','SKU-0074','SKU-0084','SKU-0083','SKU-0017',
    'SKU-0127','SKU-0131','SKU-0049','SKU-0067','SKU-0010','SKU-0068','SKU-0015','SKU-0136',
    'SKU-0118','SKU-0058','SKU-0087','SKU-0014','SKU-0066','SKU-0134','SKU-0157','SKU-0169',
    'SKU-0135','SKU-0130','SKU-0133','SKU-0018','SKU-0161','SKU-0170','SKU-0132','SKU-0042'
  )
ORDER BY soh.created_at DESC;
