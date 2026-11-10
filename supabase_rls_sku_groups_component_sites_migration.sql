-- ============================================================
-- Security: enable RLS on sku_groups, sku_group_items, component_sites
-- Run this in the R-Shift Supabase project SQL editor.
-- Fixes Supabase linter 0013_rls_disabled_in_public (ERROR) for all three.
-- ============================================================
-- These tables are exposed to PostgREST, so without RLS anyone holding the
-- public anon key could read/modify them. Same org-membership pattern as
-- the other stock tables (is_org_member). No app behaviour changes:
--   * the admin app is signed in as an org member -> passes the policies
--   * the public-stock-check / public-transfer-hub edge functions use the
--     service role key, which bypasses RLS.

ALTER TABLE sku_groups       ENABLE ROW LEVEL SECURITY;
ALTER TABLE sku_group_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE component_sites  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sku_groups_all" ON sku_groups;
CREATE POLICY "sku_groups_all" ON sku_groups
  FOR ALL USING (is_org_member(org_id))
  WITH CHECK (is_org_member(org_id));

-- sku_group_items has no org_id of its own; inherit it from the parent group.
DROP POLICY IF EXISTS "sku_group_items_all" ON sku_group_items;
CREATE POLICY "sku_group_items_all" ON sku_group_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM sku_groups g
            WHERE g.id = sku_group_items.group_id AND is_org_member(g.org_id))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM sku_groups g
            WHERE g.id = sku_group_items.group_id AND is_org_member(g.org_id))
  );

DROP POLICY IF EXISTS "component_sites_all" ON component_sites;
CREATE POLICY "component_sites_all" ON component_sites
  FOR ALL USING (is_org_member(org_id))
  WITH CHECK (is_org_member(org_id));
