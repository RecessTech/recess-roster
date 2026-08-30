-- ============================================================
-- R-Stock: Per-Site Item Lists + Ordering Workflow
-- Run this in the R-Shift Supabase project SQL editor, after
-- supabase-stock-migration.sql
-- ============================================================
-- Supersedes the per-location-par / stocktake-count model from the
-- first migration: each item now belongs to exactly one location
-- (sites run their own independent lists, per business requirement —
-- "Bourke will have a different stock list than Crown"), and stock
-- level is a manually-set status rather than computed from counts.
-- The stock_item_locations / stock_counts tables are left in place
-- but unused going forward — nothing in this migration drops them.

ALTER TABLE stock_items
  ADD COLUMN location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  ADD COLUMN sku TEXT,
  ADD COLUMN reference_order_qty NUMERIC NOT NULL DEFAULT 0,  -- from bulk-upload "Qty" — a suggested order qty, not a stock count
  ADD COLUMN order_qty NUMERIC,                                -- this cycle's qty to order, editable in Stocktake
  ADD COLUMN current_status TEXT NOT NULL DEFAULT 'in_stock'
    CHECK (current_status IN ('no_stock', 'low_stock', 'order_moq', 'in_stock')),
  ADD COLUMN ordered BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN ordered_at TIMESTAMPTZ;

CREATE INDEX idx_stock_items_location_id ON stock_items(location_id);

-- SKUs are auto-assigned per org (e.g. "SKU-0001") and must stay unique
-- within the org once set; NULL is allowed only transiently.
CREATE UNIQUE INDEX idx_stock_items_org_sku ON stock_items(org_id, sku) WHERE sku IS NOT NULL;
