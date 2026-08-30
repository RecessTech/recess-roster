-- ============================================================
-- R-Stock: "Ordered" checkbox per site
-- Run this in the R-Shift Supabase project SQL editor, after
-- supabase-stock-migration-4.sql
-- ============================================================
-- Confirms an item was ordered for next delivery, per (item, site).

ALTER TABLE stock_item_sites
  ADD COLUMN ordered BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN ordered_at TIMESTAMPTZ;
