-- Org-wide read-only "share the whole roster" link (distinct from the
-- per-staff public_token on the staff table). Anyone with this token can
-- view the week's schedule for every staff member via the public-roster
-- edge function, with no login and no wage/cost data included.

ALTER TABLE organisations ADD COLUMN IF NOT EXISTS public_token UUID DEFAULT gen_random_uuid();
UPDATE organisations SET public_token = gen_random_uuid() WHERE public_token IS NULL;
ALTER TABLE organisations ALTER COLUMN public_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_organisations_public_token ON organisations(public_token);
