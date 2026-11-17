-- ============================================================
-- R-Shift: staff PINs for the mobile "Roster" page
-- Run this in the R-Shift Supabase project SQL editor.
-- ============================================================
-- Staff reach their own shifts from the Staff Hub (/hub/<token>) by
-- tapping Roster and entering a personal 4-digit PIN. The hub token
-- identifies the org; the PIN identifies the person within it, so it
-- must be unique per org. Lo-fi on purpose: PINs are stored as plain
-- text so a manager can read one out to a staff member from the Staff
-- screen. The staff table is RLS-gated to org members, and the
-- staff-roster edge function (service role) is the only path a PIN is
-- ever checked through.
--
-- Unique among *active* staff only, so archiving someone frees their
-- PIN for reuse.

ALTER TABLE staff ADD COLUMN IF NOT EXISTS pin TEXT;

ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_pin_format;
ALTER TABLE staff ADD CONSTRAINT staff_pin_format CHECK (pin IS NULL OR pin ~ '^[0-9]{4}$');

CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_org_pin
  ON staff(org_id, pin)
  WHERE pin IS NOT NULL AND active;

-- Failed PIN attempts, for brute-force lockout (only 10,000 possible
-- PINs). The edge function counts recent rows per org + IP and per org.
-- RLS is on with no policies: nothing but the service role can touch it.
CREATE TABLE IF NOT EXISTS staff_pin_attempts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  ip         TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_pin_attempts_org_time ON staff_pin_attempts(org_id, created_at);
CREATE INDEX IF NOT EXISTS idx_staff_pin_attempts_org_ip_time ON staff_pin_attempts(org_id, ip, created_at);

ALTER TABLE staff_pin_attempts ENABLE ROW LEVEL SECURITY;
