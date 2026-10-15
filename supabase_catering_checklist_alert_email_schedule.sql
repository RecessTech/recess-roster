-- ============================================================
-- R-Cater: 8am daily catering checklist alert
-- Run this in the R-Shift Supabase project SQL editor.
-- ============================================================
-- Every hour, checks whether it's currently 8am in Sydney and -- only
-- then -- asks the deployed send-catering-checklist-alert Edge Function
-- to check for catering jobs due within 3 days that still have an
-- unticked Confirmed/Invoiced/Bread Ordered/Delivery Booked checkbox,
-- and email hello@itsrecess.com.au if so. Same self-gating trick as
-- trigger_order_status_email_if_due() (supabase_stock_order_status_
-- email_schedule.sql): scheduling hourly and gating on the local hour,
-- rather than scheduling once a day in UTC, keeps this correct across
-- the AEST/AEDT daylight-saving switch without the cron schedule itself
-- ever needing to change.
--
-- Unlike the order-status email, the Edge Function itself only sends
-- when something is actually outstanding, so a clean day is silent --
-- this is an alert, not a daily digest.
--
-- The Authorization/apikey values are this project's anon/publishable
-- key, not a secret -- the same key already ships inside the app's
-- client bundle, protected by RLS like everything else, not by being
-- hidden.

CREATE OR REPLACE FUNCTION trigger_catering_checklist_alert_if_due()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXTRACT(hour FROM (now() AT TIME ZONE 'Australia/Sydney')) <> 8 THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := 'https://agiobncbephcgmarsjeu.supabase.co/functions/v1/send-catering-checklist-alert',
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
  'send-catering-checklist-alert-hourly',
  '0 * * * *',
  $$ SELECT trigger_catering_checklist_alert_if_due(); $$
);
