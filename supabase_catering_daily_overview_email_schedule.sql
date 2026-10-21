-- ============================================================
-- R-Cater: 6am "catering today" overview
-- Run this in the R-Shift Supabase project SQL editor.
-- ============================================================
-- Every hour, checks whether it's currently 6am in Sydney and -- only
-- then -- asks the deployed send-catering-daily-overview Edge Function to
-- email an overview of every catering job booked for today to
-- hello@itsrecess.com.au, clark@itsrecess.com.au,
-- sophie.mcnaughtlee@gmail.com and paddyjlevy@gmail.com. Same self-gating
-- trick as trigger_order_status_email_if_due() (supabase_stock_order_
-- status_email_schedule.sql): scheduling hourly and gating on the local
-- hour, rather than scheduling once a day in UTC, keeps this correct
-- across the AEST/AEDT daylight-saving switch without the cron schedule
-- itself ever needing to change.
--
-- Unlike send-catering-weekly-overview, the Edge Function itself only
-- sends when there's actually a job booked that day -- a day with
-- nothing on sends nothing, so this is a same-day nudge, not a daily
-- digest.
--
-- The Authorization/apikey values are this project's anon/publishable
-- key, not a secret -- the same key already ships inside the app's
-- client bundle, protected by RLS like everything else, not by being
-- hidden.

CREATE OR REPLACE FUNCTION trigger_catering_daily_overview_if_due()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXTRACT(hour FROM (now() AT TIME ZONE 'Australia/Sydney')) <> 6 THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := 'https://agiobncbephcgmarsjeu.supabase.co/functions/v1/send-catering-daily-overview',
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
  'send-catering-daily-overview-hourly',
  '0 * * * *',
  $$ SELECT trigger_catering_daily_overview_if_due(); $$
);
