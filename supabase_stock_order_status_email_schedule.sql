-- ============================================================
-- R-Stock: 8pm daily order-status email
-- Run this in the R-Shift Supabase project SQL editor.
-- ============================================================
-- Every hour, checks whether it's currently 8pm in Sydney and -- only
-- then -- asks the deployed send-order-status-email Edge Function to
-- send the day's summary to hello@itsrecess.com.au. Same self-gating
-- trick as archive_and_reset_stock_orders() (migration-6): scheduling
-- hourly and gating on the local hour, rather than scheduling once a
-- day in UTC, keeps this correct across the AEST/AEDT daylight-saving
-- switch without ever needing the cron schedule itself to change.
--
-- The Authorization/apikey values are this project's anon/publishable
-- key, not a secret -- the same key already ships inside the app's
-- client bundle, protected by RLS like everything else, not by being
-- hidden.
--
-- NOTE: the Edge Function itself will fail (silently, from the app's
-- point of view -- no user-facing error) until a sending domain is
-- verified in Resend at resend.com/domains. The schedule below is live
-- regardless; it just won't produce a delivered email until then.

CREATE OR REPLACE FUNCTION trigger_order_status_email_if_due()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXTRACT(hour FROM (now() AT TIME ZONE 'Australia/Sydney')) <> 20 THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := 'https://agiobncbephcgmarsjeu.supabase.co/functions/v1/send-order-status-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnaW9ibmNiZXBoY2dtYXJzamV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNjc0NTYsImV4cCI6MjA5MDc0MzQ1Nn0.EuUmA3jDE3AzSmBYVphqU2HpvOKpeRgLWr7HL_VUypk',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnaW9ibmNiZXBoY2dtYXJzamV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNjc0NTYsImV4cCI6MjA5MDc0MzQ1Nn0.EuUmA3jDE3AzSmBYVphqU2HpvOKpeRgLWr7HL_VUypk'
    ),
    body := '{}'::jsonb
  );
END;
$$;

SELECT cron.schedule(
  'send-order-status-email-hourly',
  '0 * * * *',
  $$ SELECT trigger_order_status_email_if_due(); $$
);
