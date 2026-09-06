-- ============================================================
-- Transfer Hub: public read-only share link
-- Run this in the R-Shift Supabase project SQL editor, after
-- supabase_transfer_hub_migration.sql
-- ============================================================
-- Same pattern as the Roster's public_token and R-Prod's
-- production_public_token: a per-org UUID that resolves (via the
-- public-transfer-hub edge function) to a read-only dashboard, no
-- login required. Kept as its own token so it can be shared and
-- regenerated independently of the roster/production links -- handing
-- every staff member a "what's needed before I head to the other
-- site" link shouldn't also hand them the roster link.

ALTER TABLE organisations ADD COLUMN IF NOT EXISTS transfer_public_token UUID DEFAULT gen_random_uuid();
UPDATE organisations SET transfer_public_token = gen_random_uuid() WHERE transfer_public_token IS NULL;
ALTER TABLE organisations ALTER COLUMN transfer_public_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_organisations_transfer_public_token ON organisations(transfer_public_token);
