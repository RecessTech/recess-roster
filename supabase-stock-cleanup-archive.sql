-- ============================================================
-- R-Stock: One-off cleanup for last night's archive run
-- Run this after supabase-stock-migration-9.sql, once, to fix data
-- already written by the old (buggy) archive function.
-- ============================================================

-- ── 1. Backfill blank order_qty in existing history rows ────
-- Uses each item's current reference qty at its site, since that's
-- what the old function should have fallen back to.
UPDATE stock_order_history soh
SET order_qty = sis.reference_order_qty
FROM stock_item_sites sis
WHERE soh.order_qty IS NULL
  AND soh.item_id = sis.item_id
  AND soh.location_id = sis.location_id
  AND soh.org_id = (
    SELECT om.org_id FROM org_members om
    JOIN auth.users u ON u.id = om.user_id
    WHERE u.email = 'clark@itsrecess.com.au' LIMIT 1
  );

-- ── 2. Reset status for items already archived last night ───
-- Only touches rows that are (a) still stuck in a "needs action"
-- status and (b) part of the most recent archive batch -- so it
-- won't reset anything flagged fresh today during stocktake.
UPDATE stock_item_sites sis
SET current_status = 'in_stock', updated_at = NOW()
WHERE sis.current_status IN ('no_stock', 'low_stock', 'order_moq', 'request_transfer')
  AND sis.org_id = (
    SELECT om.org_id FROM org_members om
    JOIN auth.users u ON u.id = om.user_id
    WHERE u.email = 'clark@itsrecess.com.au' LIMIT 1
  )
  AND EXISTS (
    SELECT 1 FROM stock_order_history soh
    WHERE soh.item_id = sis.item_id
      AND soh.location_id = sis.location_id
      AND soh.ordered_date = (
        SELECT MAX(ordered_date) FROM stock_order_history soh2 WHERE soh2.org_id = sis.org_id
      )
  );

-- Verify: yesterday's history should now show real qtys, and none of
-- those items should still show a "needs action" status
SELECT si.name, loc.name AS site, soh.order_qty, soh.status_at_order, sis.current_status AS status_now
FROM stock_order_history soh
JOIN stock_items si ON si.id = soh.item_id
JOIN locations loc ON loc.id = soh.location_id
JOIN stock_item_sites sis ON sis.item_id = soh.item_id AND sis.location_id = soh.location_id
WHERE soh.org_id = (
    SELECT om.org_id FROM org_members om
    JOIN auth.users u ON u.id = om.user_id
    WHERE u.email = 'clark@itsrecess.com.au' LIMIT 1
  )
  AND soh.ordered_date = (
    SELECT MAX(ordered_date) FROM stock_order_history soh2
    WHERE soh2.org_id = (
      SELECT om.org_id FROM org_members om
      JOIN auth.users u ON u.id = om.user_id
      WHERE u.email = 'clark@itsrecess.com.au' LIMIT 1
    )
  )
ORDER BY si.name;
