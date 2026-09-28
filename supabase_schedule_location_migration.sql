-- ============================================================
-- R-Shift: Per-shift location (Stage 2 of location-aware rostering)
-- Run this in the R-Shift Supabase project SQL editor.
-- ============================================================
-- Stage 1 (supabase_staff_location_migration.sql) gave each staff
-- member a home site and derived every shift's site from it. That
-- breaks once someone works at both Bourke St and Crown St: they can
-- only be rostered at their home site, and changing their home site
-- silently moves all their past shifts with them.
--
-- This stamps the site on the shift itself. The app writes it on every
-- new shift (the location filter's site, else the staff member's home
-- site) and falls back to the staff member's home site for any row
-- where it is still NULL.
--
-- The backfill freezes existing shifts at their staff member's current
-- home site, so later home-site changes no longer rewrite history.

ALTER TABLE schedules ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_schedules_location_id ON schedules(org_id, location_id, date_key);

UPDATE schedules sc
SET location_id = st.location_id
FROM staff st
WHERE sc.staff_id = st.id
  AND sc.location_id IS NULL
  AND st.location_id IS NOT NULL;
