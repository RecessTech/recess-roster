# R-Shift Security Hub

Single place to track Supabase security/performance linter findings and their fixes.
Add a row per finding; link the migration that resolves it.

## Conventions

- Every table in `public` must have RLS enabled (linter `0013_rls_disabled_in_public`).
- Standard policy: `FOR ALL USING (is_org_member(org_id)) WITH CHECK (is_org_member(org_id))`.
  Child tables without `org_id` inherit it via an `EXISTS` on the parent.
- Public staff links (Stock Check, Transfer Hub) go through edge functions using the
  service role key, so they never need anon-facing policies.
- New tables: enable RLS and add policies in the same migration that creates them.

## Findings

| Date | Lint | Object | Level | Status | Fix |
|---|---|---|---|---|---|
| 2026-11-10 | rls_disabled_in_public | `public.sku_groups` | ERROR | Fixed (applied 2026-11-10) | `supabase_rls_sku_groups_component_sites_migration.sql` |
| 2026-11-10 | rls_disabled_in_public | `public.sku_group_items` | ERROR | Fixed (applied 2026-11-10) | same |
| 2026-11-10 | rls_disabled_in_public | `public.component_sites` | ERROR | Fixed (applied 2026-11-10) | same |
| 2026-11-10 | rls_policy_always_true | `organisations` `org_insert`, `organisations_insert` | WARN | Fixed (applied) | `supabase_security_hardening_20261110.sql` (dropped; orgs are created via `create_org_for_user`) |
| 2026-11-10 | rls_policy_always_true | `production_plan_edit_log` | WARN | Fixed (applied) | same (now `is_org_member`; edge function uses service role) |
| 2026-11-10 | anon_/authenticated_security_definer_function_executable | 5 cron-only functions | WARN | Fixed (applied) | same (EXECUTE revoked; pg_cron runs as postgres) |
| 2026-11-10 | anon_security_definer_function_executable | `create_org_for_user`, `get_org_members_with_email`, `is_org_member` | WARN | Fixed (applied) | same (anon revoked) |
| 2026-11-10 | authenticated_security_definer_function_executable | `create_org_for_user`, `get_org_members_with_email`, `is_org_member` | WARN | **Accepted** | App calls these while signed in; RLS needs `is_org_member`. Expect these 3 to remain. |
| 2026-11-10 | extension_in_public | `pg_net` | WARN | **Open** | Not relocatable; needs drop + `create extension pg_net with schema extensions`. Brief gap for the 15-min `check-order-confirmations` cron and the 4 email crons. Do it in a quiet window. |
| 2026-11-10 | auth_leaked_password_protection | Auth | WARN | **Open (dashboard)** | Dashboard > Authentication > Password security > enable leaked password protection (may need Pro plan). |
| 2026-11-10 | rls_enabled_no_policy | `gmail_poll_state`, `staff_pin_attempts` | INFO | **Accepted** | Intentional: service-role-only tables, no client access wanted. |

## Open risks found while triaging

- `org_members_insert` policy (`WITH CHECK user_id = auth.uid()`) lets any signed-in user add *themselves* to *any* org if they know its id. Orgs are joined via `create_org_for_user` (definer), so this policy looks unnecessary; consider dropping it after confirming no invite flow relies on it.
- The `check-order-confirmations` cron embeds the project anon JWT in the cron command (public by design, but visible to anyone who can read `cron.job`). Make sure that edge function verifies its own caller.

## Notes

- `component_sites` and `sku_group_items.component_id` are used by the app but have no
  `CREATE TABLE`/`ALTER` in the repo's migration files (likely applied via the SQL editor).
  Worth backfilling the schema into a migration so the repo matches production.
- After applying, re-run the Supabase advisors and confirm the three ERRORs clear.
