-- ============================================================
-- R-Stock: Direct unit cost override
-- Run this in the R-Shift Supabase project SQL editor.
-- ============================================================
-- For 3rd-party resale items sold as a single unit (a bottled drink,
-- a packaged snack) bought by the case, the existing pack_size/pack_cost
-- model asks a confusing question when uom describes the case itself
-- (e.g. uom = "12-pack") -- "how many 12-packs are in a 12-pack?".
--
-- Rather than rename uom (which Stocktake/Ordering/order history also
-- read, and would relabel live-counted items and existing order
-- history), this adds a direct per-unit cost override that only
-- R-Recipe's costing cares about. When set, it takes priority over
-- pack_cost/pack_size in cost_per_uom -- every screen that already
-- reads cost_per_uom (R-Recipe, Insights, etc.) picks it up for free,
-- no other code changes needed. Stocktake/Ordering/order history are
-- untouched, since none of them read cost at all.

ALTER TABLE stock_items ADD COLUMN direct_unit_cost NUMERIC;

-- Generated columns can't have their expression altered in place,
-- so drop and recreate cost_per_uom with the override folded in.
-- This recomputes cleanly for every existing row -- pack_cost/pack_size
-- math is unchanged for anything that doesn't set direct_unit_cost.
ALTER TABLE stock_items DROP COLUMN cost_per_uom;
ALTER TABLE stock_items ADD COLUMN cost_per_uom NUMERIC GENERATED ALWAYS AS (
  CASE
    WHEN direct_unit_cost IS NOT NULL THEN direct_unit_cost
    WHEN pack_size IS NOT NULL AND pack_size > 0 AND pack_cost IS NOT NULL THEN pack_cost / pack_size
    ELSE NULL
  END
) STORED;
