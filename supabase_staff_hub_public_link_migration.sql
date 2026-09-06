-- ============================================================
-- Staff Hub: a single landing link for staff, pointing at the
-- read-only R-Prod and Transfer Hub pages
-- ============================================================
-- Same pattern as public_token / production_public_token /
-- transfer_public_token: a per-org UUID that resolves (via the
-- public-staff-hub edge function) to a landing page, no login
-- required. This link doesn't carry any data of its own -- it just
-- looks up the org's existing production_public_token and
-- transfer_public_token and hands back two links to page for staff
-- to tap through to. Kept as its own token (rather than reusing one
-- of the others) so it can be regenerated independently.

ALTER TABLE organisations ADD COLUMN IF NOT EXISTS staff_hub_public_token UUID DEFAULT gen_random_uuid();
UPDATE organisations SET staff_hub_public_token = gen_random_uuid() WHERE staff_hub_public_token IS NULL;
ALTER TABLE organisations ALTER COLUMN staff_hub_public_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_organisations_staff_hub_public_token ON organisations(staff_hub_public_token);
