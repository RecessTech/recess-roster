-- ============================================================
-- R-Prod mobile edit history (already applied directly to the
-- live project via the Supabase MCP -- this file just records
-- the change for history).
--
-- Backs the new lock/unlock edit flow on the staff-facing mobile
-- production-plan link: producers can unlock the quantities,
-- amend them intraday, then re-lock -- which prompts for a name
-- and writes one row here per save, recording exactly which
-- item/channel quantities changed for accountability.
-- ============================================================

create table if not exists production_plan_edit_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  site_id uuid not null references production_sites(id) on delete cascade,
  plan_date date not null,
  edited_by_name text not null,
  edited_at timestamptz not null default now(),
  changes jsonb not null default '[]'::jsonb
);

create index if not exists idx_production_plan_edit_log_org_date
  on production_plan_edit_log (org_id, plan_date);

alter table production_plan_edit_log enable row level security;

create policy production_plan_edit_log_all on production_plan_edit_log
  for all to public using (true) with check (true);
