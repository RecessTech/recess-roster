-- ============================================================
-- R-Stock: Fix nightly archive — qty fallback + status reset
-- Run this in the R-Shift Supabase project SQL editor, after
-- supabase-stock-migration-8.sql
-- ============================================================
-- Two bugs in the archive_and_reset_stock_orders() function from
-- migration-6:
--
-- 1. order_qty was archived as-is. The app only ever shows the
--    reference qty as a fallback in the UI when order_qty is blank
--    -- it never wrote that fallback back to the row -- so anything
--    nobody manually re-typed a qty for landed in history as NULL
--    ("--" in the History tab) instead of the reference qty that was
--    actually used.
-- 2. current_status was deliberately left untouched on archive (a
--    "it's a separate physical stocktake flag" call made when this
--    was first built). In practice that meant an item marked ordered
--    kept showing as needing order in Stocktake/Ordering the next
--    day. Status now resets to 'in_stock' for anything archived.
--
-- Same function signature, so CREATE OR REPLACE is enough -- no need
-- to touch the pg_cron schedule.

CREATE OR REPLACE FUNCTION archive_and_reset_stock_orders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXTRACT(hour FROM (now() AT TIME ZONE 'Australia/Sydney')) <> 0 THEN
    RETURN;
  END IF;

  INSERT INTO stock_order_history (org_id, item_id, location_id, supplier, order_qty, status_at_order, ordered_date)
  SELECT org_id, item_id, location_id, supplier, COALESCE(order_qty, reference_order_qty), current_status,
         ((now() AT TIME ZONE 'Australia/Sydney')::date - INTERVAL '1 day')::date
  FROM stock_item_sites
  WHERE ordered = true;

  UPDATE stock_item_sites
  SET ordered = false, ordered_at = NULL, order_qty = NULL, current_status = 'in_stock', updated_at = NOW()
  WHERE ordered = true;
END;
$$;
