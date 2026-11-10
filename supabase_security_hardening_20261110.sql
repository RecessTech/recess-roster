-- ============================================================
-- Security hardening from the 2026-11-10 Supabase linter run
-- ============================================================
-- Everything here is safe for the app: the admin app is an authenticated org
-- member; public staff links use edge functions with the service role (bypasses
-- RLS and grants); pg_cron jobs run as the postgres owner.

-- 1. rls_policy_always_true: organisations INSERT.
--    Orgs are created only via create_org_for_user() (SECURITY DEFINER), so no
--    client needs direct INSERT. Dropping both permissive policies = no direct inserts.
DROP POLICY IF EXISTS "org_insert" ON organisations;
DROP POLICY IF EXISTS "organisations_insert" ON organisations;

-- 2. rls_policy_always_true: production_plan_edit_log. Only the
--    public-production edge function (service role) touches it.
DROP POLICY IF EXISTS "production_plan_edit_log_all" ON production_plan_edit_log;
CREATE POLICY "production_plan_edit_log_all" ON production_plan_edit_log
  FOR ALL TO authenticated
  USING (is_org_member(org_id))
  WITH CHECK (is_org_member(org_id));

-- 3. SECURITY DEFINER functions callable over /rest/v1/rpc.
-- Cron-only: nobody should call these via the API.
REVOKE EXECUTE ON FUNCTION archive_and_reset_stock_orders()          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION trigger_catering_checklist_alert_if_due() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION trigger_catering_daily_overview_if_due()  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION trigger_catering_weekly_overview_if_due() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION trigger_order_status_email_if_due()       FROM PUBLIC, anon, authenticated;

-- Signed-in app use only: keep authenticated, remove anon/public.
-- (Linter keeps flagging these for authenticated; that is intentional --
-- the app calls them, and each checks auth.uid()/org membership itself.)
REVOKE EXECUTE ON FUNCTION create_org_for_user(text)         FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION get_org_members_with_email(uuid)  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION is_org_member(uuid)               FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION create_org_for_user(text)         TO authenticated;
GRANT  EXECUTE ON FUNCTION get_org_members_with_email(uuid)  TO authenticated;
GRANT  EXECUTE ON FUNCTION is_org_member(uuid)               TO authenticated;
