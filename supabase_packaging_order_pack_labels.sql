-- ============================================================
-- R-Stock: packaging pack-size fix + order-pack labels
-- ============================================================
-- 1. Napkins (SKU-0026) got pack_size dropped to 1 during a recent
--    data-entry pass, while units_per_carton stayed at 2000 -- with
--    pack_cost still $22, that made cost_per_uom read $22.00/napkin
--    instead of $0.011. Confirmed with the user: 2000/carton, $22/carton,
--    ordered one carton at a time. order_pack_label was already
--    correctly set to 'carton' and is left alone.
-- 2. Every other packaging item now has a correct, matching pack_size/
--    units_per_carton (fixed in the prior pass), but order_pack_label
--    was never set -- so Stocktake/Ordering has no way to show "1
--    carton" and bank the full pack_size on receipt; it would just
--    bank whatever raw number gets typed. Sets order_pack_label =
--    'carton' for every standard packaging item ordered that way
--    (confirmed: everything below except Cling Wrap -- ordered as a
--    single dispenser roll, no carton -- and Baking Paper / Foil --
--    confirmed as one roll each, pack_size = 1 is correct as-is).
-- ============================================================

-- ── 1. Napkins: restore pack_size ───────────────────────────────
UPDATE stock_items
SET pack_size = 2000, updated_at = now()
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1)
  AND sku = 'SKU-0026' -- Napkins
  AND pack_size = 1;

-- ── 2. Set order_pack_label = 'carton' for the rest of packaging ──
UPDATE stock_items
SET order_pack_label = 'carton', updated_at = now()
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1)
  AND category = 'PCK'
  AND order_pack_label IS NULL
  AND sku IN (
    'SKU-0171', -- 8oz Coffee Lid
    'SKU-0023', -- Bin Bags
    'SKU-0174', -- Boats
    'SKU-0177', -- Carry Bags
    'SKU-0192', 'SKU-0193', -- Catering Tray 1 (Base/Lid)
    'SKU-0194', 'SKU-0195', -- Catering Tray 2 (Base/Lid)
    'SKU-0172', 'SKU-0173', -- Catering Tray 3 (Base/Lid)
    'SKU-0196', 'SKU-0197', -- Catering Tray 4 (Base/Lid)
    'SKU-0198', -- Equals
    'SKU-0188', 'SKU-0191', -- Gloves (Large/Medium)
    'SKU-0200', -- Greaseproof Paper
    'SKU-0175', -- Iced Cups
    'SKU-0176', -- Iced Lids
    'SKU-0187', -- Large Coffee Cups (10oz)
    'SKU-0186', -- Medium Coffee Cups (8oz)
    'SKU-0207', -- Round Sticker (4cm x 4cm)
    'SKU-0178', -- Salad Bowl (Kraft)
    'SKU-0190', -- Salad Bowl (White)
    'SKU-0179', -- Salad Lid
    'SKU-0183', -- Sandwich Lids
    'SKU-0182', -- Sandwich Tubs
    'SKU-0185', -- Small Coffee Cups (6oz)
    'SKU-0181', -- Soup Container w/ Lids
    'SKU-0184', -- Straws
    'SKU-0204', -- Tuckshop Bag Number 4
    'SKU-0199', -- Wooden Fork
    'SKU-0189'  -- Wooden Spoons
  );

-- ── VERIFY ─────────────────────────────────────────────────────
SELECT name, sku, uom, order_pack_label, units_per_carton, pack_size, pack_cost, cost_per_uom,
  CASE
    WHEN pack_size IS NULL THEN 'no pack_size (Cling Wrap only, by design)'
    WHEN units_per_carton IS NOT NULL AND units_per_carton <> pack_size THEN 'MISMATCH'
    WHEN order_pack_label IS NULL AND pack_size <> 1 THEN 'still no order_pack_label'
    ELSE 'ok'
  END AS flag
FROM stock_items
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1)
  AND category = 'PCK'
ORDER BY name;
