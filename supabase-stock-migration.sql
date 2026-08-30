-- ============================================================
-- R-Stock: Multi-Site Inventory Schema Migration
-- Run this in the R-Shift Supabase project SQL editor
-- Depends on: organisations, org_members, is_org_member() from
-- supabase-rshift-migration.sql (must be applied first)
-- ============================================================

-- ── 1. LOCATIONS ─────────────────────────────────────────────
-- A site/venue within an org (e.g. "Shop", "Busstop"). Generic —
-- any org can define any number of these.

CREATE TABLE locations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_locations_org_id     ON locations(org_id);
CREATE INDEX idx_locations_org_active ON locations(org_id, active);

-- ── 2. STOCK ITEMS ───────────────────────────────────────────
-- Master SKU list, replacing the "Rubric" Google Sheet's row list.

CREATE TABLE stock_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  category   TEXT,                        -- e.g. 'PRO', 'Dry Goods', 'PHF', 'Consumables'
  uom        TEXT NOT NULL DEFAULT 'units',
  supplier   TEXT,                        -- free text for now
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stock_items_org_id     ON stock_items(org_id);
CREATE INDEX idx_stock_items_org_active ON stock_items(org_id, active);

-- ── 3. STOCK ITEM LOCATIONS ──────────────────────────────────
-- Per-location par level for each item (same SKU can have a
-- different par at each site).

CREATE TABLE stock_item_locations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  item_id     UUID NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  par_level   NUMERIC NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (item_id, location_id)
);

CREATE INDEX idx_stock_item_locations_org_id      ON stock_item_locations(org_id);
CREATE INDEX idx_stock_item_locations_item_id     ON stock_item_locations(item_id);
CREATE INDEX idx_stock_item_locations_location_id ON stock_item_locations(location_id);

-- ── 4. STOCK COUNTS ───────────────────────────────────────────
-- Stocktake log. Current stock for an (item, location) is the
-- most recent row here — no consumption-rate estimation.

CREATE TABLE stock_counts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  item_id      UUID NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  location_id  UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  counted_qty  NUMERIC NOT NULL,
  counted_at   DATE NOT NULL DEFAULT CURRENT_DATE,
  counted_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stock_counts_org_id  ON stock_counts(org_id);
CREATE INDEX idx_stock_counts_latest  ON stock_counts(item_id, location_id, counted_at DESC, created_at DESC);

-- ── 5. ROW LEVEL SECURITY ────────────────────────────────────
-- Same pattern as the core schema: gated on org membership via
-- the existing is_org_member() helper.

ALTER TABLE locations            ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_item_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_counts         ENABLE ROW LEVEL SECURITY;

CREATE POLICY "locations_all" ON locations
  FOR ALL USING (is_org_member(org_id))
  WITH CHECK (is_org_member(org_id));

CREATE POLICY "stock_items_all" ON stock_items
  FOR ALL USING (is_org_member(org_id))
  WITH CHECK (is_org_member(org_id));

CREATE POLICY "stock_item_locations_all" ON stock_item_locations
  FOR ALL USING (is_org_member(org_id))
  WITH CHECK (is_org_member(org_id));

CREATE POLICY "stock_counts_all" ON stock_counts
  FOR ALL USING (is_org_member(org_id))
  WITH CHECK (is_org_member(org_id));
