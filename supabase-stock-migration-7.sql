-- ============================================================
-- R-Stock: Product detail + supplier code
-- Run this in the R-Shift Supabase project SQL editor, after
-- supabase-stock-migration-6.sql
-- ============================================================
-- description/units_per_carton describe the physical product itself,
-- so they live on the shared catalog (stock_items) — same spec
-- regardless of which site orders it.
--
-- supplier_code is the SUPPLIER's own catalog code for this item —
-- since the same SKU can have a different supplier at each site (see
-- migration-2), the code that goes with that supplier lives on
-- stock_item_sites too, not on the item itself.

ALTER TABLE stock_items
  ADD COLUMN description TEXT,
  ADD COLUMN units_per_carton NUMERIC;

ALTER TABLE stock_item_sites
  ADD COLUMN supplier_code TEXT;
