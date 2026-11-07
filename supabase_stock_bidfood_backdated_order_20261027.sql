-- ============================================================
-- R-Stock: backdate a real Bidfood order that was never ticked
-- ============================================================
-- Invoice I72050066.BOT (Bidfood, delivered 28/10/2026, Crown St) proves
-- 9 of its 10 line items were actually ordered on 27/10/2026, but nobody
-- ticked "Ordered" in the app that day -- stock_item_sites.ordered stayed
-- false, so the nightly archive never wrote a stock_order_history row for
-- it, and the "Last ordered" badge kept showing each item's previous
-- (stale, up to 16-days-old) archived order instead.
--
-- Since ordered/ordered_at on stock_item_sites is live state (the nightly
-- archive_and_reset_stock_orders() job would sweep it up and archive it
-- under *today's* date, not the 27th), this writes straight to
-- stock_order_history instead -- a one-off manual entry, same shape as
-- what the nightly job itself writes, dated correctly.
--
-- order_qty is the invoice's "Quantity Supplied" (cartons/each) converted
-- to each item's base UoM via stock_items.pack_size, matching how every
-- other row in this table is recorded. status_at_order uses each item's
-- current_status at the time this was run (28/10/2026) as the best
-- available proxy for what it was on the 27th.
--
-- The invoice's 10th line (Pesto Basil, Bidfood code 171627) has no
-- matching row here -- R-Stock's "Pesto" item already has a correct
-- 27/10/2026 entry from its usual supplier (Foodlink), so there was
-- nothing to fix there.

INSERT INTO stock_order_history (org_id, item_id, location_id, supplier, order_qty, status_at_order, ordered_date)
VALUES
  ('788c4cea-50dd-4284-a218-3a971c8b510d', '8e4e070e-bc24-46ca-be54-b3984a4583f9', 'ef30975d-1a70-4d4f-9004-3721ebcdeddf', 'Bidfood', 9360,  'in_stock',  '2026-10-27'),  -- Eggs: 1 ctn x 9360g
  ('788c4cea-50dd-4284-a218-3a971c8b510d', '535503ab-dd54-45dc-932c-3266841f7e5b', 'ef30975d-1a70-4d4f-9004-3721ebcdeddf', 'Bidfood', 24000, 'in_stock',  '2026-10-27'),  -- Full Cream Milk: 2 ctn x 12000ml
  ('788c4cea-50dd-4284-a218-3a971c8b510d', '0f6b58d8-6859-49a5-963a-be27ea839b9c', 'ef30975d-1a70-4d4f-9004-3721ebcdeddf', 'Bidfood', 2500,  'low_stock', '2026-10-27'),  -- Canned Chickpeas (Big): 1 x 2500g
  ('788c4cea-50dd-4284-a218-3a971c8b510d', '2068fb09-10da-465c-9637-bb0e43b3a5bd', 'ef30975d-1a70-4d4f-9004-3721ebcdeddf', 'Bidfood', 1,     'low_stock', '2026-10-27'),  -- Coke Zero: 1 ctn
  ('788c4cea-50dd-4284-a218-3a971c8b510d', '5c3141c1-5149-4e22-96ce-e5bf9c9c5e4c', 'ef30975d-1a70-4d4f-9004-3721ebcdeddf', 'Bidfood', 2000,  'low_stock', '2026-10-27'),  -- Coconut Milk: 2 ea x 1000ml
  ('788c4cea-50dd-4284-a218-3a971c8b510d', 'af365f81-4f93-4d5f-9b99-38d2b60c7db0', 'ef30975d-1a70-4d4f-9004-3721ebcdeddf', 'Bidfood', 12000, 'in_stock',  '2026-10-27'),  -- Almond Milk: 1 ctn x 12000ml
  ('788c4cea-50dd-4284-a218-3a971c8b510d', '4625b013-e2c0-4122-b13a-a70db7d877b0', 'ef30975d-1a70-4d4f-9004-3721ebcdeddf', 'Bidfood', 12000, 'in_stock',  '2026-10-27'),  -- Oat Milk: 1 ctn x 12000ml
  ('788c4cea-50dd-4284-a218-3a971c8b510d', '94254020-01a6-4ae2-9e34-4cb2b5246982', 'ef30975d-1a70-4d4f-9004-3721ebcdeddf', 'Bidfood', 16,    'low_stock', '2026-10-27'),  -- Paper Towel: 1 ctn x 16
  ('788c4cea-50dd-4284-a218-3a971c8b510d', '0d624262-8642-4c21-8832-7febfc676186', 'ef30975d-1a70-4d4f-9004-3721ebcdeddf', 'Bidfood', 24000, 'in_stock',  '2026-10-27');  -- Soy Milk: 2 ctn x 12000ml

-- ── VERIFY ─────────────────────────────────────────────────────
SELECT si.name, soh.ordered_date, soh.order_qty, soh.status_at_order
FROM stock_order_history soh
JOIN stock_items si ON si.id = soh.item_id
WHERE soh.ordered_date = '2026-10-27' AND soh.location_id = 'ef30975d-1a70-4d4f-9004-3721ebcdeddf'
ORDER BY si.name;
