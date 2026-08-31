-- ============================================================
-- R-Stock: Allow "request_transfer" as a current_status value
-- Run this in the R-Shift Supabase project SQL editor, after
-- supabase-stock-migration-7.sql
-- ============================================================
-- migration-3's CHECK constraint only allowed the original four
-- statuses, so setting an item to "Request Transfer" in the app
-- fails with a constraint violation until this runs.

ALTER TABLE stock_item_sites DROP CONSTRAINT stock_item_sites_current_status_check;

ALTER TABLE stock_item_sites
  ADD CONSTRAINT stock_item_sites_current_status_check
    CHECK (current_status IN ('no_stock', 'low_stock', 'order_moq', 'in_stock', 'request_transfer'));
