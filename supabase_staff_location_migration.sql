-- ============================================================
-- R-Shift: Location-aware rostering
-- Run this in the R-Shift Supabase project SQL editor.
-- ============================================================
-- Rostering (staff/schedules/availability/templates) has had no
-- concept of "which site" since the business was single-location.
-- Now that there's a second site, this adds a location_id to staff,
-- reusing R-Stock's existing `locations` table (Crown St, Bourke St)
-- as the single canonical site list for R-Shift -- rather than
-- inventing a second one. Schedules/availability/templates derive
-- their site from the staff member assigned to them, so they don't
-- need their own location_id column.
--
-- Nullable and additive: existing staff are unassigned until someone
-- sets their location in the Staff screen, and every other part of
-- the app keeps working unfiltered until a location filter is chosen.

ALTER TABLE staff ADD COLUMN location_id UUID REFERENCES locations(id) ON DELETE SET NULL;

CREATE INDEX idx_staff_location_id ON staff(location_id);
