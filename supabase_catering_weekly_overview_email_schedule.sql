-- ============================================================
-- R-Cater: Sunday 6pm "week ahead" catering overview
-- Run this in the R-Shift Supabase project SQL editor.
-- ============================================================
-- Every hour, checks whether it's currently Sunday 6pm in Sydney and --
-- only then -- asks the deployed send-catering-weekly-overview Edge
-- Function to email every catering job booked for the coming Monday-Sunday
-- week, grouped by day, to hello@itsrecess.com.au, clark@itsrecess.com.au,
-- sophie.mcnaughtlee@gmail.com and paddyjlevy@gmail.com. Same self-gating
-- trick as trigger_order_status_email_if_due() (supabase_stock_order_
-- status_email_schedule.sql): scheduling hourly and gating on the local
-- day-of-week + hour, rather than scheduling once a week in UTC, keeps
-- this correct across the AEST/AEDT daylight-saving switch without the
-- cron schedule itself ever needing to change.
--
-- Unlike send-catering-daily-overview, this one sends every week
-- regardless of whether anything is booked -- an empty week ahead is
-- still worth knowing about, so it's a true weekly digest, not an alert.
--
-- The Authorization/apikey values are this project's anon/publishable
-- key, not a secret -- the same key already ships inside the app's
-- client bundle, protected by RLS like everything else, not by being
-- hidden.

CREATE OR REPLACE FUNCTION trigger_catering_weekly_overview_if_due()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sydney_now timestamp := (now() AT TIME ZONE 'Australia/Sydney');
BEGIN
  -- EXTRACT(dow ...) is 0 for Sunday, 6 for Saturday.
  IF EXTRACT(dow FROM sydney_now) <> 0 OR EXTRACT(hour FROM sydney_now) <> 18 THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := 'https://agiobncbephcgmarsjeu.supabase.co/functions/v1/send-catering-weekly-overview',
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
  'send-catering-weekly-overview-hourly',
  '0 * * * *',
  $$ SELECT trigger_catering_weekly_overview_if_due(); $$
);
