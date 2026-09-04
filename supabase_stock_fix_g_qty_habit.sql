-- ============================================================
-- Fix: order quantities entered kg-scale against SKUs that were
-- ALWAYS correctly labelled 'g' (unlike the earlier kg -> g fix,
-- there's no uom relabel here -- these 24 SKUs never had the wrong
-- label, someone just kept typing a kg-scale number into the order
-- qty fields regardless).
--
-- Confirmed via the same pack-size ratio test as every other fix in
-- this series: e.g. Ham Shaved reference_order_qty=1 against a 1000g
-- pack is 0.001 of a pack (nonsensical); Chicken Breast=12 against a
-- 1000g pack is 0.012 (nonsensical). Every one of these 24 lands in
-- the same implausible range, both in live reorder qty and in
-- archived order history.
--
-- Deliberately NOT included: 6 SKUs (Peppercorns, Garlic Granules,
-- Onion Flakes, Toasted Sesame Seeds, Poppy Seeds, Fennel Seeds)
-- showing 500-600 with no pack_size to cross-check -- that's a
-- plausible real spice-jar order, not a confirmed error, so left
-- alone rather than guessed at.
-- ============================================================

DO $$
DECLARE
  v_org_id UUID := (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1);
  v_sites_count INT;
  v_history_count INT;
  v_skus TEXT[] := ARRAY[
    'SKU-0001','SKU-0002','SKU-0012','SKU-0037','SKU-0039','SKU-0041','SKU-0047','SKU-0051',
    'SKU-0052','SKU-0060','SKU-0065','SKU-0069','SKU-0071','SKU-0077','SKU-0090','SKU-0091',
    'SKU-0092','SKU-0095','SKU-0096','SKU-0098','SKU-0099','SKU-0100','SKU-0105','SKU-0154'
  ];
BEGIN
  -- Live reorder quantities (reference_order_qty always set; order_qty
  -- only Tomato Chutney has one active right now, but handled generally).
  UPDATE stock_item_sites sis
  SET reference_order_qty = CASE WHEN sis.reference_order_qty IS NOT NULL THEN sis.reference_order_qty * 1000 ELSE sis.reference_order_qty END,
      order_qty = CASE WHEN sis.order_qty IS NOT NULL THEN sis.order_qty * 1000 ELSE NULL END,
      updated_at = now()
  FROM stock_items si
  WHERE sis.item_id = si.id AND si.org_id = v_org_id AND si.sku = ANY(v_skus);
  GET DIAGNOSTICS v_sites_count = ROW_COUNT;

  -- Archived order history for the same SKUs.
  UPDATE stock_order_history soh
  SET order_qty = soh.order_qty * 1000
  FROM stock_items si
  WHERE soh.item_id = si.id AND si.org_id = v_org_id AND si.sku = ANY(v_skus)
    AND soh.order_qty IS NOT NULL;
  GET DIAGNOSTICS v_history_count = ROW_COUNT;

  RAISE NOTICE 'Scaled % stock_item_sites rows and % stock_order_history rows for the 24 confirmed SKUs',
    v_sites_count, v_history_count;
END $$;

-- ── VERIFY ─────────────────────────────────────────────────────
SELECT si.sku, si.name, si.pack_size, sis.reference_order_qty, sis.order_qty
FROM stock_items si
JOIN stock_item_sites sis ON sis.item_id = si.id
WHERE si.org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1)
  AND si.sku IN (
    'SKU-0001','SKU-0002','SKU-0012','SKU-0037','SKU-0039','SKU-0041','SKU-0047','SKU-0051',
    'SKU-0052','SKU-0060','SKU-0065','SKU-0069','SKU-0071','SKU-0077','SKU-0090','SKU-0091',
    'SKU-0092','SKU-0095','SKU-0096','SKU-0098','SKU-0099','SKU-0100','SKU-0105','SKU-0154'
  )
ORDER BY si.sku;
