-- ============================================================
-- R-Stock: Order Qty per Site
-- Run this in the R-Shift Supabase project SQL editor, after
-- supabase-stock-migration-3.sql
-- ============================================================
-- Editable "how much to order this cycle" per (item, site) —
-- distinct from reference_order_qty (the suggested/default from
-- upload), which stays as a fallback when order_qty hasn't been set.

ALTER TABLE stock_item_sites
  ADD COLUMN order_qty NUMERIC;
