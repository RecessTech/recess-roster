-- ============================================================
-- R-Stock: Supplier assignments (who orders which supplier)
-- Run this in the R-Shift Supabase project SQL editor, after
-- supabase-stock-migration-9.sql
-- ============================================================
-- Lets each supplier be assigned to one org member, powering a
-- "My Suppliers" filter on Stocktake/Ordering. This is a convenience
-- view, not an access restriction -- every org member can still see
-- every supplier's items (same is_org_member RLS as everything else
-- in R-Stock), the filter just narrows what they look at by default.

CREATE TABLE supplier_assignments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  supplier   TEXT NOT NULL,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, supplier)
);

CREATE INDEX idx_supplier_assignments_org_id ON supplier_assignments(org_id);

ALTER TABLE supplier_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "supplier_assignments_all" ON supplier_assignments
  FOR ALL USING (is_org_member(org_id))
  WITH CHECK (is_org_member(org_id));

-- Lets the app show real emails in the "assign this supplier to"
-- dropdown -- auth.users isn't directly queryable by clients, so this
-- SECURITY DEFINER function exposes just id+email for members of an
-- org the caller is themselves a member of.
CREATE OR REPLACE FUNCTION get_org_members_with_email(target_org_id UUID)
RETURNS TABLE (user_id UUID, email TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT om.user_id, u.email
  FROM org_members om
  JOIN auth.users u ON u.id = om.user_id
  WHERE om.org_id = target_org_id
    AND is_org_member(target_org_id);
$$;
