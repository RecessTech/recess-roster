-- ============================================================
-- Fix: SKUs labelled 'kg' that are actually 'g'.
--
-- Diagnosis: every stock_items row with uom='kg' has a pack_size in
-- the hundreds-to-thousands (e.g. 1000, 1500, 2270, 15000) -- those
-- are gram-scale pack sizes, not kg (nobody buys a "15000 kg" tub of
-- mayo for $123.42; a 15000g / 15kg tub for $123.42 is completely
-- normal). Recipe usage confirms it: e.g. Brown Onion's biggest
-- recipe line references "2000" of it -- 2000 kg is nonsensical for
-- a batch, 2000g (2kg) is exactly right.
--
-- The fix is ONLY the uom label. pack_size and pack_cost already
-- describe the real pack correctly (in grams) and don't change.
-- cost_per_uom is a generated column (pack_cost / pack_size) so it
-- recalculates automatically -- e.g. Mayo goes from a nonsense
-- $0.0082/kg to a correct $0.0082/g = $8.23/kg.
-- ============================================================

DO $$
DECLARE
  v_org_id UUID := (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1);
  v_count INT;
BEGIN
  UPDATE stock_items
  SET uom = 'g', updated_at = now()
  WHERE org_id = v_org_id AND uom = 'kg';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Relabelled % SKUs from kg to g', v_count;
END $$;

-- ── VERIFY ─────────────────────────────────────────────────────
-- Should show 0 rows -- confirms no 'kg' SKUs remain.
SELECT sku, name, uom FROM stock_items
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1)
  AND uom = 'kg';

-- Spot-check: cost_per_uom should now read as sensible $/g (multiply
-- by 1000 in your head for $/kg -- e.g. 0.0082 here = $8.20/kg).
SELECT sku, name, uom, pack_size, pack_cost, cost_per_uom
FROM stock_items
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1)
  AND sku IN ('SKU-0085', 'SKU-0004', 'SKU-0101', 'SKU-0102', 'SKU-0093')
ORDER BY sku;
