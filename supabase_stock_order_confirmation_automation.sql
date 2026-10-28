-- ============================================================
-- R-Stock: auto-mark Ordered from a supplier's confirmation email,
-- and flag a rough price-variance warning against expected cost.
-- Run this in the R-Shift Supabase project SQL editor.
-- ============================================================
-- Two related upgrades to check-order-confirmations, both keyed off the
-- same event (a brand-new confirmation email matched to a supplier):
--
-- 1. Auto-mark Ordered. Staff were still expected to manually tick every
--    item in the Ordering tab even though the inbox already proves the
--    order went in -- a step that's been a repeat source of false "not
--    ordered" alerts (see the Blackforest/Fruitique same-day-confirmation
--    fix). The Edge Function now ticks ordered=true/ordered_at on every
--    currently-outstanding (needs-order, not deferred, not yet ordered)
--    stock_item_sites row for that supplier across every location, the
--    moment a new confirmation lands.
--
-- 2. Price-variance flag. Best-effort: the Edge Function regex-extracts a
--    dollar total from the confirmation email body (invoice_total) and
--    compares it to the sum of order_qty * stock_items.cost_per_uom across
--    the rows it just auto-marked (expected_total). Either can be wrong
--    (a supplier's email might not have an extractable total; cost_per_uom
--    isn't populated for every item) -- priced_item_count records how many
--    of the auto-marked rows actually had a cost to sum, so the UI can
--    suppress the comparison when coverage is too thin to mean anything.

ALTER TABLE supplier_order_confirmations
  ADD COLUMN IF NOT EXISTS invoice_total numeric,
  ADD COLUMN IF NOT EXISTS expected_total numeric,
  ADD COLUMN IF NOT EXISTS auto_marked_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS priced_item_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN supplier_order_confirmations.invoice_total IS
  'Best-effort $ total regex-extracted from the confirmation email body. Null if no recognizable total line was found.';
COMMENT ON COLUMN supplier_order_confirmations.expected_total IS
  'Sum of order_qty * stock_items.cost_per_uom across the stock_item_sites rows this confirmation auto-marked as ordered. Null if nothing was auto-marked.';
COMMENT ON COLUMN supplier_order_confirmations.auto_marked_count IS
  'How many stock_item_sites rows this confirmation flipped to ordered=true.';
COMMENT ON COLUMN supplier_order_confirmations.priced_item_count IS
  'Of auto_marked_count, how many had a non-null cost_per_uom and so contributed to expected_total.';
