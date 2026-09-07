-- ============================================================
-- Transfer Hub: let a request specify its own quantity unit
-- Run this in the R-Shift Supabase project SQL editor
-- ============================================================
-- A SKU/component's catalog uom (stock_items.uom / recipe_components.uom)
-- is its canonical unit for stock-taking and costing, but someone raising
-- a transfer request often wants to ask for a different practical unit --
-- "2 sleeves" or "3 kg" rather than whatever the catalog says. This is a
-- free-text label chosen from a fixed list in the app UI, not a foreign
-- key or enum -- kept loose like `note`, not locked down with a CHECK
-- constraint. NULL means "use the catalog's uom", for rows created before
-- this existed.

ALTER TABLE transfer_requests ADD COLUMN IF NOT EXISTS quantity_unit TEXT;
