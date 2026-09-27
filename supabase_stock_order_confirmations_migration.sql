-- ============================================================
-- R-Stock: Gmail order-confirmation matching
-- Run this in the R-Shift Supabase project SQL editor.
-- ============================================================
-- Lets the Order Status tab distinguish "someone ticked Ordered" from
-- "the supplier's confirmation email actually landed in
-- hello@itsrecess.com.au". A scheduled Edge Function
-- (check-order-confirmations) polls that inbox via the Gmail API and
-- writes a row here for every confirmation email it can match to a
-- supplier, using confirmation_email_match as a case-insensitive
-- substring check against the email's From header.
--
-- Three things need to happen before this does anything useful:
--  1. This migration (adds the column + two tables + the cron job).
--  2. Set confirmation_email_match per supplier in the "Classify
--     suppliers" modal (e.g. 'mybidfood.com.au' for Bidfood).
--  3. Set GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN
--     as Edge Function secrets (Project Settings -> Edge Functions ->
--     Secrets) -- these come from a one-time Google Cloud OAuth setup
--     for hello@itsrecess.com.au, done outside this codebase.
--
-- Until all three are done, supplier_order_confirmations just stays
-- empty and the Order Status tab keeps showing "Order Placed" (the
-- existing manual checkbox) rather than a verified "Confirmed".

ALTER TABLE supplier_metadata
  ADD COLUMN confirmation_email_match TEXT;

CREATE TABLE supplier_order_confirmations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  supplier          TEXT NOT NULL,
  gmail_message_id  TEXT NOT NULL,
  from_address      TEXT,
  subject           TEXT,
  received_at       TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, gmail_message_id)
);

CREATE INDEX idx_supplier_order_confirmations_lookup ON supplier_order_confirmations(org_id, supplier, received_at DESC);

ALTER TABLE supplier_order_confirmations ENABLE ROW LEVEL SECURITY;

-- Read-only from the app's side -- rows are written only by the Edge
-- Function below, using the service role key (bypasses RLS).
CREATE POLICY "supplier_order_confirmations_select" ON supplier_order_confirmations
  FOR SELECT USING (is_org_member(org_id));

-- Watermark so each poll only asks Gmail for messages newer than the
-- last successful check, instead of rescanning the whole inbox.
CREATE TABLE gmail_poll_state (
  id           TEXT PRIMARY KEY,
  last_checked TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE gmail_poll_state ENABLE ROW LEVEL SECURITY;
-- No app-facing policy -- only the Edge Function (service role) ever
-- reads/writes this table.

-- ── SCHEDULE ──────────────────────────────────────────────────
-- Every 15 minutes, ask the deployed Edge Function to check for new
-- confirmation emails. The Authorization/apikey values are this
-- project's anon/publishable key, not a secret -- the same key already
-- ships inside the app's client bundle, protected by RLS like
-- everything else, not by being hidden.

CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'check-order-confirmations-15min',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://agiobncbephcgmarsjeu.supabase.co/functions/v1/check-order-confirmations',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnaW9ibmNiZXBoY2dtYXJzamV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNjc0NTYsImV4cCI6MjA5MDc0MzQ1Nn0.EuUmA3jDE3AzSmBYVphqU2HpvOKpeRgLWr7HL_VUypk',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnaW9ibmNiZXBoY2dtYXJzamV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNjc0NTYsImV4cCI6MjA5MDc0MzQ1Nn0.EuUmA3jDE3AzSmBYVphqU2HpvOKpeRgLWr7HL_VUypk'
    ),
    body := '{}'::jsonb
  );
  $$
);
