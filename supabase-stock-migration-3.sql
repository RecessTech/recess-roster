-- ============================================================
-- R-Stock Step 2: Per-Site Stock Status Flagging
-- Run this in the R-Shift Supabase project SQL editor, after
-- supabase-stock-migration-2.sql
-- ============================================================
-- Adds a manually-set status per (item, site) — Crown St and
-- Bourke St flag the same shared item independently, since status
-- lives on the join, not on stock_items itself.
--
-- Deliberately NOT included yet: order qty this cycle, "ordered"
-- checkbox, consolidated ordering, or inter-site transfers — all
-- Step 3, layered on top of this without changing what's here.

ALTER TABLE stock_item_sites
  ADD COLUMN current_status TEXT NOT NULL DEFAULT 'in_stock'
    CHECK (current_status IN ('no_stock', 'low_stock', 'order_moq', 'in_stock'));
