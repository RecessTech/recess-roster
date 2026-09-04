-- ============================================================
-- Business corrections to standard order sizes (not a unit bug --
-- these SKUs were already correctly unit-fixed; the actual target
-- quantity was just wrong). Updates both the live reference qty and
-- matching archived order-history rows, using exact absolute values
-- (not a multiplier) so this is safe to re-run.
--
--   Pickled Cucumber:        1kg -> 5kg
--   Seeded Mustard:          1kg -> 2.5kg
--   Dijon:                   1kg -> 2.5kg
--   Canned Chickpeas (Big):  2kg -> 2.5kg
-- ============================================================

DO $$
DECLARE
  v_org_id UUID := (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1);
BEGIN
  -- Pickled Cucumber: 1000 -> 5000
  UPDATE stock_item_sites sis SET reference_order_qty = 5000, updated_at = now()
  FROM stock_items si WHERE sis.item_id = si.id AND si.org_id = v_org_id AND si.sku = 'SKU-0001' AND sis.reference_order_qty = 1000;
  UPDATE stock_order_history soh SET order_qty = 5000
  FROM stock_items si WHERE soh.item_id = si.id AND si.org_id = v_org_id AND si.sku = 'SKU-0001' AND soh.order_qty = 1000;

  -- Seeded Mustard: 1000 -> 2500
  UPDATE stock_item_sites sis SET reference_order_qty = 2500, updated_at = now()
  FROM stock_items si WHERE sis.item_id = si.id AND si.org_id = v_org_id AND si.sku = 'SKU-0007' AND sis.reference_order_qty = 1000;
  UPDATE stock_order_history soh SET order_qty = 2500
  FROM stock_items si WHERE soh.item_id = si.id AND si.org_id = v_org_id AND si.sku = 'SKU-0007' AND soh.order_qty = 1000;

  -- Dijon: 1000 -> 2500
  UPDATE stock_item_sites sis SET reference_order_qty = 2500, updated_at = now()
  FROM stock_items si WHERE sis.item_id = si.id AND si.org_id = v_org_id AND si.sku = 'SKU-0006' AND sis.reference_order_qty = 1000;
  UPDATE stock_order_history soh SET order_qty = 2500
  FROM stock_items si WHERE soh.item_id = si.id AND si.org_id = v_org_id AND si.sku = 'SKU-0006' AND soh.order_qty = 1000;

  -- Canned Chickpeas (Big): 2000 -> 2500
  UPDATE stock_item_sites sis SET reference_order_qty = 2500, updated_at = now()
  FROM stock_items si WHERE sis.item_id = si.id AND si.org_id = v_org_id AND si.sku = 'SKU-0039' AND sis.reference_order_qty = 2000;
  UPDATE stock_order_history soh SET order_qty = 2500
  FROM stock_items si WHERE soh.item_id = si.id AND si.org_id = v_org_id AND si.sku = 'SKU-0039' AND soh.order_qty = 2000;
END $$;

-- ── VERIFY ─────────────────────────────────────────────────────
SELECT si.sku, si.name, sis.reference_order_qty
FROM stock_items si JOIN stock_item_sites sis ON sis.item_id = si.id
WHERE si.org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1)
  AND si.sku IN ('SKU-0001','SKU-0007','SKU-0006','SKU-0039')
ORDER BY si.sku;

SELECT si.sku, si.name, soh.order_qty, soh.ordered_date
FROM stock_order_history soh JOIN stock_items si ON si.id = soh.item_id
WHERE si.org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1)
  AND si.sku IN ('SKU-0001','SKU-0007','SKU-0006','SKU-0039')
ORDER BY si.sku, soh.ordered_date;
