-- ============================================================
-- R-Stock: Bourke St end-of-day stock check & replenishment routing
-- Run this in the R-Shift Supabase project SQL editor.
-- ============================================================
-- Built from Clark's "R-Stock — Bourke St Inventory & Replenishment"
-- spec (2026-10-28), reconciled against the schema that actually
-- exists (the spec's own §9.1/§9.2 explicitly asked for this before
-- any migration got written):
--
-- - No new items table. stock_items + stock_item_sites already IS the
--   "inventory_items" concept (sort_order/order_pack_label/pack_size/
--   active already do the job of sort_index/unit_label/order_pack_size/
--   active). This just adds the handful of columns that genuinely don't
--   exist yet to stock_item_sites -- the existing current_status enum
--   (in_stock/low_stock/no_stock/order_moq) is NOT replaced; it's a
--   different, already load-bearing concept (order urgency, driving the
--   Ordering tab/Order Status tab/8pm email/Bidfood auto-confirm), not
--   the same thing as a shelf's physical fullness. current_level is new
--   and sits alongside it; a client-side mapping derives one from the
--   other at stock-check submit time.
-- - No new replenishments table. A flagged supplier-route item just
--   gets current_status/current_level set -- it shows up for free in
--   every existing R-Stock screen that already reads current_status.
--   A flagged transfer-route item becomes a normal transfer_requests
--   row -- Transfer Hub's existing Fulfil flow handles it completely
--   unchanged, and "emergency transfer" (spec §4) needs no new code at
--   all, since that's just a human creating a Transfer Hub request
--   manually, which already works today.
-- - stock_checks / stock_check_lines ARE genuinely new -- nothing
--   existing captures "every item's shelf level at a point in time,"
--   only live current-state.

-- ── stock_item_sites: route + physical-level columns ──────────────
ALTER TABLE stock_item_sites
  ADD COLUMN IF NOT EXISTS fulfilment_route TEXT NOT NULL DEFAULT 'supplier'
    CHECK (fulfilment_route IN ('supplier', 'transfer')),
  ADD COLUMN IF NOT EXISTS transfer_source_location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS current_level TEXT
    CHECK (current_level IS NULL OR current_level IN ('full', 'half', 'low', 'critical')),
  ADD COLUMN IF NOT EXISTS current_level_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reorder_trigger_level TEXT NOT NULL DEFAULT 'low'
    CHECK (reorder_trigger_level IN ('full', 'half', 'low', 'critical'));

COMMENT ON COLUMN stock_item_sites.fulfilment_route IS
  'Fixed per item+location: supplier (goes through the normal Ordering flow) or transfer (becomes a Transfer Hub request from transfer_source_location_id).';
COMMENT ON COLUMN stock_item_sites.current_level IS
  'Physical shelf fullness from the end-of-day stock check (full/half/low/critical) -- distinct from current_status, which is order urgency. Latest-state only; history lives in stock_check_lines.';
COMMENT ON COLUMN stock_item_sites.reorder_trigger_level IS
  'A check flags this item when current_level is at or below this (rank: full > half > low > critical). Default low; tighten to half/full for safety-stock items, loosen to critical for forgiving ones.';

-- ── stock_checks: one per completed end-of-day walk ────────────────
CREATE TABLE IF NOT EXISTS stock_checks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  location_id     UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  performed_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  performed_by_name TEXT,
  performed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status          TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── stock_check_lines: the captured level per item on that check ──
CREATE TABLE IF NOT EXISTS stock_check_lines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  stock_check_id  UUID NOT NULL REFERENCES stock_checks(id) ON DELETE CASCADE,
  site_id         UUID NOT NULL REFERENCES stock_item_sites(id) ON DELETE CASCADE,
  level           TEXT NOT NULL CHECK (level IN ('full', 'half', 'low', 'critical')),
  flagged         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_checks_org_loc        ON stock_checks(org_id, location_id);
CREATE INDEX IF NOT EXISTS idx_stock_check_lines_check_id  ON stock_check_lines(stock_check_id);
CREATE INDEX IF NOT EXISTS idx_stock_check_lines_site_id   ON stock_check_lines(site_id);
CREATE INDEX IF NOT EXISTS idx_stock_item_sites_route      ON stock_item_sites(fulfilment_route);

ALTER TABLE stock_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_check_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_checks_all" ON stock_checks
  FOR ALL USING (is_org_member(org_id)) WITH CHECK (is_org_member(org_id));

CREATE POLICY "stock_check_lines_all" ON stock_check_lines
  FOR ALL USING (is_org_member(org_id)) WITH CHECK (is_org_member(org_id));
