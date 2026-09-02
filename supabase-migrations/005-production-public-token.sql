-- Public read-only share token for the R-Prod daily production plan.
-- Kept separate from organisations.public_token (the Roster share link)
-- so the two links can be shared and regenerated independently — sharing
-- production numbers with a supplier shouldn't also hand them the roster.

ALTER TABLE organisations ADD COLUMN IF NOT EXISTS production_public_token UUID DEFAULT gen_random_uuid();
UPDATE organisations SET production_public_token = gen_random_uuid() WHERE production_public_token IS NULL;
ALTER TABLE organisations ALTER COLUMN production_public_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_organisations_production_public_token ON organisations(production_public_token);
