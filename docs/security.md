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
| 2026-11-10 | rls_disabled_in_public | `public.sku_groups` | ERROR | Fix written, **apply to Supabase** | `supabase_rls_sku_groups_component_sites_migration.sql` |
| 2026-11-10 | rls_disabled_in_public | `public.sku_group_items` | ERROR | Fix written, **apply to Supabase** | same |
| 2026-11-10 | rls_disabled_in_public | `public.component_sites` | ERROR | Fix written, **apply to Supabase** | same |

## Notes

- `component_sites` and `sku_group_items.component_id` are used by the app but have no
  `CREATE TABLE`/`ALTER` in the repo's migration files (likely applied via the SQL editor).
  Worth backfilling the schema into a migration so the repo matches production.
- After applying, re-run the Supabase advisors and confirm the three ERRORs clear.
