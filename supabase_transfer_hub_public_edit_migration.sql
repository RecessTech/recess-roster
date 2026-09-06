-- ============================================================
-- Transfer Hub: let the public link create & fulfil requests
-- Run this in the R-Shift Supabase project SQL editor, after
-- supabase_transfer_hub_components_migration.sql
-- ============================================================
-- The public /transfers/<token> page is staff-facing but has no login,
-- so there's no auth.users id to attach to a request made from it.
-- These free-text columns hold whatever name someone types in on that
-- page -- separate from requested_by/actioned_by (which stay UUIDs
-- pointing at real accounts, used by the logged-in app). A row has
-- either the UUID or the free-text name for a given side, never
-- meaningfully both.

ALTER TABLE transfer_requests ADD COLUMN IF NOT EXISTS requested_by_name TEXT;
ALTER TABLE transfer_requests ADD COLUMN IF NOT EXISTS actioned_by_name TEXT;
