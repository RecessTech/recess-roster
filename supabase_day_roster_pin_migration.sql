-- ============================================================
-- R-Shift: PIN for the mobile "Day Roster" page
-- Run this in the R-Shift Supabase project SQL editor.
-- ============================================================
-- The Day Roster tile on the Staff Hub (/hub/<token>) opens a page
-- showing the whole team's roster for any day, behind a single
-- shared 4-digit PIN (organisations.roster_view_pin) -- unlike the
-- personal Roster page, whose PIN is per staff member.
--
-- NULL means the page is switched off for that organisation. It's
-- set below only for It's Recess; any other organisation stays off
-- until it sets its own. Failed attempts are rate-limited through the
-- same staff_pin_attempts table as the personal Roster page.

ALTER TABLE organisations ADD COLUMN IF NOT EXISTS roster_view_pin TEXT;

ALTER TABLE organisations DROP CONSTRAINT IF EXISTS organisations_roster_view_pin_format;
ALTER TABLE organisations ADD CONSTRAINT organisations_roster_view_pin_format
  CHECK (roster_view_pin IS NULL OR roster_view_pin ~ '^[0-9]{4}$');

UPDATE organisations SET roster_view_pin = '5555' WHERE id = '788c4cea-50dd-4284-a218-3a971c8b510d';
