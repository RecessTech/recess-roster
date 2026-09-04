-- ============================================================
-- Fix: SKUs labelled 'L' that are actually 'ml'.
--
-- Same bug as the kg -> g fix, same evidence shape: every stock_items
-- row with uom='L' has a pack_size in the hundreds-to-thousands
-- (e.g. 1000, 5000, 12000) -- those are mL-scale pack sizes, not
-- litres (a "12000 L" carton of milk for $20.46 is absurd; a 12000ml
-- / 12L carton for $20.46 = $1.71/L is completely normal). Recipe
-- usage confirms it: White Wine Vinegar's biggest recipe line
-- references "240" -- nonsensical as 240 litres in one dressing
-- batch, exactly right as 240ml. Cross-checking reference_order_qty
-- against pack_size gives a clean whole number of packs for every
-- one of the 18 SKUs (e.g. Full Cream Milk 24 / 12L pack = 2.0
-- crates) -- confirming those live reorder quantities are genuinely
-- litre-scale and need the same x1000 correction.
--
-- Unlike the kg fix (done in three separate passes as each gap was
-- found), this does all three in one transaction: live reorder qty,
-- archived order history, and the uom relabel itself -- so there's
-- no window where the label is fixed but a quantity isn't yet.
-- ============================================================

DO $$
DECLARE
  v_org_id UUID := (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1);
  v_sites_count INT;
  v_history_count INT;
  v_uom_count INT;
BEGIN
  -- Step 1: scale live reorder quantities x1000, while uom still says 'L'.
  UPDATE stock_item_sites sis
  SET reference_order_qty = sis.reference_order_qty * 1000,
      order_qty = CASE WHEN sis.order_qty IS NOT NULL THEN sis.order_qty * 1000 ELSE NULL END,
      updated_at = now()
  FROM stock_items si
  WHERE sis.item_id = si.id AND si.org_id = v_org_id AND si.uom = 'L';
  GET DIAGNOSTICS v_sites_count = ROW_COUNT;

  -- Step 2: scale archived order history x1000, same condition.
  UPDATE stock_order_history soh
  SET order_qty = soh.order_qty * 1000
  FROM stock_items si
  WHERE soh.item_id = si.id AND si.org_id = v_org_id AND si.uom = 'L'
    AND soh.order_qty IS NOT NULL;
  GET DIAGNOSTICS v_history_count = ROW_COUNT;

  -- Step 3: relabel the SKUs themselves, last (steps 1-2 depend on
  -- uom still reading 'L' to scope correctly).
  UPDATE stock_items
  SET uom = 'ml', updated_at = now()
  WHERE org_id = v_org_id AND uom = 'L';
  GET DIAGNOSTICS v_uom_count = ROW_COUNT;

  RAISE NOTICE 'Scaled % stock_item_sites rows, % stock_order_history rows, relabelled % SKUs from L to ml',
    v_sites_count, v_history_count, v_uom_count;
END $$;

-- ── VERIFY ─────────────────────────────────────────────────────
-- Should show 0 rows -- confirms no 'L' SKUs remain.
SELECT sku, name, uom FROM stock_items
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1)
  AND uom = 'L';

-- Everything about these 18 SKUs in one place: pricing, live reorder
-- qty, and archived history, all should now read at the ml scale.
SELECT 'pricing' AS check_type, si.sku, si.name, si.uom, si.pack_size::text, si.pack_cost::text AS val, si.cost_per_uom::text AS val2
FROM stock_items si
WHERE si.org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1)
  AND si.sku IN ('SKU-0044','SKU-0046','SKU-0063','SKU-0064','SKU-0106','SKU-0107','SKU-0108','SKU-0109','SKU-0110')

UNION ALL

SELECT 'live_reorder', si.sku, si.name, si.uom, sis.reference_order_qty::text, sis.order_qty::text, NULL
FROM stock_items si
JOIN stock_item_sites sis ON sis.item_id = si.id
WHERE si.org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1)
  AND si.sku IN ('SKU-0044','SKU-0046','SKU-0063','SKU-0064','SKU-0106','SKU-0107','SKU-0108','SKU-0109','SKU-0110')

UNION ALL

SELECT 'order_history', si.sku, si.name, si.uom, soh.order_qty::text, soh.ordered_date::text, NULL
FROM stock_items si
JOIN stock_order_history soh ON soh.item_id = si.id
WHERE si.org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1)
  AND si.sku IN ('SKU-0044','SKU-0046','SKU-0063','SKU-0064','SKU-0106','SKU-0107','SKU-0108','SKU-0109','SKU-0110')

ORDER BY check_type, sku;
