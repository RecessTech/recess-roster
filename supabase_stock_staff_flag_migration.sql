-- ============================================================
-- R-Stock: let staff flag a SKU as running low, for admin review
-- Run this in the R-Shift Supabase project SQL editor
-- ============================================================
-- Deliberately NOT the same thing as current_status='low_stock' -- that's
-- the admin's own call during a stocktake count. This is a separate
-- signal staff can raise from the public Transfer Hub link (no login),
-- surfaced as a badge in Stocktake for the admin to review and clear --
-- it never writes to current_status itself, so a staff flag can't
-- silently override what the last stocktake actually found.

ALTER TABLE stock_item_sites ADD COLUMN IF NOT EXISTS staff_flagged_low BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE stock_item_sites ADD COLUMN IF NOT EXISTS staff_flagged_at TIMESTAMPTZ;
ALTER TABLE stock_item_sites ADD COLUMN IF NOT EXISTS staff_flagged_by_name TEXT;
