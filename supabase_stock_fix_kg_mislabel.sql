-- ============================================================
-- Fix: SKUs labelled 'kg' that are actually 'g'.
--
-- Diagnosis (uom/pack_size): every stock_items row with uom='kg' has
-- a pack_size in the hundreds-to-thousands (e.g. 1000, 1500, 2270,
-- 15000) -- those are gram-scale pack sizes, not kg (nobody buys a
-- "15000 kg" tub of mayo for $123.42; a 15000g / 15kg tub for $123.42
-- is completely normal). Recipe usage confirms it: e.g. Brown Onion's
-- biggest recipe line references "2000" of it -- 2000 kg is
-- nonsensical for a batch, 2000g (2kg) is exactly right.
--
-- pack_size and pack_cost already describe the real pack correctly
-- (in grams) and don't change. cost_per_uom is a generated column
-- (pack_cost / pack_size) so it recalculates automatically -- e.g.
-- Mayo goes from a nonsense $0.0082/kg to a correct $8.23/kg.
--
-- Diagnosis (reference_order_qty/order_qty): these are a SEPARATE
-- number from pack_size, entered by a different process (originally
-- imported from the old ordering spreadsheet), and cross-checking
-- them against pack_size shows they're genuinely kg-scale -- e.g.
-- Mayo's reference_order_qty=15 divided by its 15kg pack comes out
-- to exactly 1.0 (order 1 tub); Garlic Powder 5 / 5kg pack = 1.0;
-- Jalapenos 3.8 / 3.8kg pack = 1.0. 28 of the 34 SKUs with a
-- pack_size set land on a clean whole-number-of-packs this way.
-- So unlike pack_size, these DO need to scale x1000 to keep meaning
-- the same amount once uom flips to grams -- otherwise "order 15"
-- silently becomes "order 15g" instead of "order 15kg (1 tub)".
-- ============================================================

DO $$
DECLARE
  v_org_id UUID := (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1);
  v_qty_count INT;
  v_uom_count INT;
BEGIN
  -- Step 1: scale live reorder quantities x1000, while uom still says
  -- 'kg' so this only touches the affected SKUs.
  UPDATE stock_item_sites sis
  SET reference_order_qty = sis.reference_order_qty * 1000,
      order_qty = CASE WHEN sis.order_qty IS NOT NULL THEN sis.order_qty * 1000 ELSE NULL END,
      updated_at = now()
  FROM stock_items si
  WHERE sis.item_id = si.id
    AND si.org_id = v_org_id
    AND si.uom = 'kg';
  GET DIAGNOSTICS v_qty_count = ROW_COUNT;

  -- Step 2: relabel the SKUs themselves.
  UPDATE stock_items
  SET uom = 'g', updated_at = now()
  WHERE org_id = v_org_id AND uom = 'kg';
  GET DIAGNOSTICS v_uom_count = ROW_COUNT;

  RAISE NOTICE 'Scaled % stock_item_sites reorder qty rows, relabelled % SKUs from kg to g', v_qty_count, v_uom_count;
END $$;

-- ── VERIFY ─────────────────────────────────────────────────────
-- Should show 0 rows -- confirms no 'kg' SKUs remain.
SELECT sku, name, uom FROM stock_items
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1)
  AND uom = 'kg';

-- Spot-check pricing: cost_per_uom should now read as sensible $/g
-- (multiply by 1000 in your head for $/kg -- e.g. 0.0082 here =
-- $8.20/kg).
SELECT sku, name, uom, pack_size, pack_cost, cost_per_uom
FROM stock_items
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1)
  AND sku IN ('SKU-0085', 'SKU-0004', 'SKU-0101', 'SKU-0102', 'SKU-0093')
ORDER BY sku;

-- Spot-check reorder qty: reference_order_qty should now be in the
-- thousands, roughly lining up with pack_size (e.g. Mayo should read
-- pack_size=15000, reference_order_qty=15000 -- "order 1 tub").
SELECT si.sku, si.name, si.pack_size, sis.reference_order_qty, sis.order_qty
FROM stock_items si
JOIN stock_item_sites sis ON sis.item_id = si.id
WHERE si.org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1)
  AND si.sku IN ('SKU-0085', 'SKU-0004', 'SKU-0101', 'SKU-0102', 'SKU-0093')
ORDER BY si.sku;
