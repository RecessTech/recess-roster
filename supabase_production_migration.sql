-- ============================================================
-- R-Prod: Daily Production Planning Schema Migration
-- Run this in the R-Shift Supabase project SQL editor
--
-- Depends on: organisations, org_members, is_org_member() from
-- supabase-rshift-migration.sql (must be applied first)
--
-- This supersedes the original (site-less) version of this
-- migration. Safe to re-run: drops and recreates the R-Prod
-- tables from scratch, so run this even if you already applied
-- the first version.
-- ============================================================

DROP TABLE IF EXISTS production_plan_entries CASCADE;
DROP TABLE IF EXISTS production_channels     CASCADE;
DROP TABLE IF EXISTS production_items        CASCADE;
DROP TABLE IF EXISTS production_sites         CASCADE;

-- ── 1. PRODUCTION SITES ───────────────────────────────────────
-- The physical kitchen/location doing the producing (e.g. "Crown
-- St", "Bourke St"). Each site produces for one or more channels.

CREATE TABLE production_sites (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_production_sites_org_id     ON production_sites(org_id);
CREATE INDEX idx_production_sites_org_active ON production_sites(org_id, active);

-- ── 2. PRODUCTION CHANNELS ───────────────────────────────────
-- A destination for what a site produces (e.g. Crown St ->
-- "Transfer to Crown" / "B2B"; Bourke St -> "In-Store").

CREATE TABLE production_channels (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  site_id    UUID NOT NULL REFERENCES production_sites(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_production_channels_org_id     ON production_channels(org_id);
CREATE INDEX idx_production_channels_site_id    ON production_channels(site_id);
CREATE INDEX idx_production_channels_org_active ON production_channels(org_id, active);

-- ── 3. PRODUCTION ITEMS ───────────────────────────────────────
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

-- ── 4. PRODUCTION PLAN ENTRIES ────────────────────────────────
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

-- ── 5. ROW LEVEL SECURITY ─────────────────────────────────────
-- Same pattern as the rest of the schema: gated on org membership
-- via the existing is_org_member() helper.

ALTER TABLE production_sites        ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_channels     ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_plan_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "production_sites_all" ON production_sites
  FOR ALL USING (is_org_member(org_id))
  WITH CHECK (is_org_member(org_id));

CREATE POLICY "production_channels_all" ON production_channels
  FOR ALL USING (is_org_member(org_id))
  WITH CHECK (is_org_member(org_id));

CREATE POLICY "production_items_all" ON production_items
  FOR ALL USING (is_org_member(org_id))
  WITH CHECK (is_org_member(org_id));

CREATE POLICY "production_plan_entries_all" ON production_plan_entries
  FOR ALL USING (is_org_member(org_id))
  WITH CHECK (is_org_member(org_id));
