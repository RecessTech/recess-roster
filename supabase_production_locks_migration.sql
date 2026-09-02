-- ============================================================
-- R-Prod: Finalize/Lock a day's production numbers
-- Run this in the R-Shift Supabase project SQL editor, after
-- supabase_production_migration.sql
-- ============================================================

-- Marking a (site, date) as finalized locks further edits to that
-- site's channel quantities for that day, turning R-Prod into a
-- production record rather than only a live planning tool.

CREATE TABLE production_day_locks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  site_id    UUID NOT NULL REFERENCES production_sites(id) ON DELETE CASCADE,
  plan_date  DATE NOT NULL,
  locked_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (site_id, plan_date)
);

CREATE INDEX idx_production_day_locks_org_id ON production_day_locks(org_id);
CREATE INDEX idx_production_day_locks_lookup ON production_day_locks(site_id, plan_date);

ALTER TABLE production_day_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "production_day_locks_all" ON production_day_locks
  FOR ALL USING (is_org_member(org_id))
  WITH CHECK (is_org_member(org_id));
