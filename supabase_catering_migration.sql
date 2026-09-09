-- ============================================================
-- R-Cater: Catering Job Scheduling Schema Migration
-- Run this in the R-Shift Supabase project SQL editor
--
-- Depends on: organisations, org_members, is_org_member() from
-- supabase-rshift-migration.sql (must be applied first)
-- ============================================================

-- ── CATERING JOBS ─────────────────────────────────────────────
-- One row per catering job (one company/order on one day). Menu
-- item breakdown is kept as JSONB on the row itself -- it's a
-- small, job-specific list ([{ name, qty }]) with no need (yet)
-- for cross-job aggregation, so a join table would just be
-- overhead. Prep-quantity calculations against recipes are a
-- later phase, per the product brief.

CREATE TABLE catering_jobs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,

  job_date          DATE NOT NULL,
  company           TEXT,
  contact           TEXT,
  job_type          TEXT,          -- Breakfast / Lunch / Morning Tea / Afternoon Tea / Other
  address           TEXT,
  ready_by          TEXT,          -- "Pick-Up Time" in the UI -- kitchen-logistics time, set by admin
  deliver_by        TEXT,          -- delivery time requested by the customer -- freeform, often a range
  delivery_method   TEXT,          -- Pick-up / Courier / CW / etc.

  platter_size      INTEGER,       -- number of people the sandwich platter serves
  pieces_per_person NUMERIC,
  salads            TEXT,          -- freeform: box sizes/counts vary ("2 x Large")
  breakfast_ppl     INTEGER,
  coffee_ppl        INTEGER,

  gf_ppl            INTEGER,
  vego_ppl          INTEGER,
  pb_ppl            INTEGER,
  dairy_free_ppl    INTEGER,
  halal_ppl         INTEGER,

  confirmed         BOOLEAN NOT NULL DEFAULT FALSE,
  invoiced          BOOLEAN NOT NULL DEFAULT FALSE,
  bread_ordered     BOOLEAN NOT NULL DEFAULT FALSE,
  delivery_booked   BOOLEAN NOT NULL DEFAULT FALSE,

  gross_rev         NUMERIC,
  notes             TEXT,

  items             JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{ name, qty }, ...]

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_catering_jobs_org_id   ON catering_jobs(org_id);
CREATE INDEX idx_catering_jobs_org_date ON catering_jobs(org_id, job_date);

ALTER TABLE catering_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "catering_jobs_all" ON catering_jobs
  FOR ALL USING (is_org_member(org_id))
  WITH CHECK (is_org_member(org_id));
