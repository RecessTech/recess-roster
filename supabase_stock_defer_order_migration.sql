-- ============================================================
-- R-Stock: defer an item's order past this cycle
-- Run this in the R-Shift Supabase project SQL editor.
-- ============================================================
-- Lets staff push a genuinely-low item out of "needs ordering" on the
-- Order Status tab (and the 8pm order-status email) without pretending
-- it's been ordered -- e.g. a Foodlink item that's low but will go on
-- the next larger Foodlink order rather than a one-off. Set from the
-- Ordering tab's new "Defer" button, which sets this to tomorrow's
-- date; current_status is untouched, so Stocktake/Ordering keep
-- showing the item normally -- only the Order Status/email urgency
-- calc treats it as handled until the date passes.

ALTER TABLE stock_item_sites ADD COLUMN deferred_until DATE;
