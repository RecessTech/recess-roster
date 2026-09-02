-- ============================================================
-- R-Prod: Daily Production Planning Schema Migration
-- Run this in the R-Shift Supabase project SQL editor
-- Depends on: organisations, org_members, is_org_member() from
-- supabase-rshift-migration.sql (must be applied first)
-- ============================================================

-- ── 1. PRODUCTION CHANNELS ───────────────────────────────────
-- Where produced items go (e.g. "Bus Stop", "Shop", "Vending").
-- Replaces the per-day Trello board's lists.

CREATE TABLE production_channels (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_production_channels_org_id     ON production_channels(org_id);
CREATE INDEX idx_production_channels_org_active ON production_channels(org_id, active);

-- ── 2. PRODUCTION ITEMS ───────────────────────────────────────
-- Menu item catalog (e.g. "Chicken Avo", "Caesar"). `color` backs
-- the category dot/badge, mirroring the Trello card label colours.

CREATE TABLE production_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  category   TEXT,
  color      TEXT NOT NULL DEFAULT '#94A3B8',
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_production_items_org_id     ON production_items(org_id);
CREATE INDEX idx_production_items_org_active ON production_items(org_id, active);

-- ── 3. PRODUCTION PLAN ENTRIES ────────────────────────────────
-- The quantity of one item, for one channel, on one date. This is
-- the "Chicken Avo x 20" card, just structured instead of freeform.

CREATE TABLE production_plan_entries (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  item_id    UUID NOT NULL REFERENCES production_items(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES production_channels(id) ON DELETE CASCADE,
  plan_date  DATE NOT NULL,
  qty        NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (item_id, channel_id, plan_date)
);

CREATE INDEX idx_production_plan_org_id ON production_plan_entries(org_id);
CREATE INDEX idx_production_plan_date   ON production_plan_entries(org_id, plan_date);

-- ── 4. ROW LEVEL SECURITY ─────────────────────────────────────
-- Same pattern as the rest of the schema: gated on org membership
-- via the existing is_org_member() helper.

ALTER TABLE production_channels     ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_plan_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "production_channels_all" ON production_channels
  FOR ALL USING (is_org_member(org_id))
  WITH CHECK (is_org_member(org_id));

CREATE POLICY "production_items_all" ON production_items
  FOR ALL USING (is_org_member(org_id))
  WITH CHECK (is_org_member(org_id));

CREATE POLICY "production_plan_entries_all" ON production_plan_entries
  FOR ALL USING (is_org_member(org_id))
  WITH CHECK (is_org_member(org_id));
