-- ============================================================
-- R-Stock: Bourke St packaging items that are transfer-fed, not ordered
-- ============================================================
-- Clark's call: Bourke keeps a small buffer box of these and gets
-- replenished daily from Crown St (1 sleeve/day is enough), rather than
-- ordering them directly from Premier North Pak the way Bourke's other
-- packaging does. Flips route on the 3 items he named explicitly
-- (Sandwich Tubs, Sandwich Lids, Boats); Catering Trays/Salad Bowls/Soup
-- Containers stay on the supplier route -- he didn't name those, and
-- they weren't assumed in.

UPDATE stock_item_sites
SET fulfilment_route = 'transfer',
    transfer_source_location_id = (SELECT id FROM locations WHERE name = 'Crown St'),
    updated_at = now()
WHERE location_id = (SELECT id FROM locations WHERE name = 'Bourke St')
  AND item_id IN (
    SELECT id FROM stock_items WHERE name IN ('Sandwich Tubs', 'Sandwich Lids', 'Boats')
  );

-- ── VERIFY ─────────────────────────────────────────────────────
SELECT si.name, sis.fulfilment_route, l.name AS transfer_source
FROM stock_item_sites sis
JOIN stock_items si ON si.id = sis.item_id
LEFT JOIN locations l ON l.id = sis.transfer_source_location_id
WHERE sis.location_id = (SELECT id FROM locations WHERE name = 'Bourke St')
  AND si.name IN ('Sandwich Tubs', 'Sandwich Lids', 'Boats');
