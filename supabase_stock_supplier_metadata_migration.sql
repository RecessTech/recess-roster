-- ============================================================
-- R-Stock: Supplier metadata (order channel, portal, search URL)
-- Run this in the R-Shift Supabase project SQL editor.
-- ============================================================
-- Powers the Ordering page's "Agent View" -- an AI browser agent needs to
-- know which suppliers are portal-orderable (vs email/phone), and how to
-- deep-link into a portal search for a given item.
--
-- This is a NEW, separate table rather than an extension of
-- supplier_assignments (the existing "My Suppliers" table): 4 of the 16
-- suppliers currently in use (Aarons Organics, Mateo, NCPS, Stickeroo)
-- have no supplier_assignments row at all, and that table's user_id is
-- NOT NULL, so bolting this metadata onto it would either break for those
-- four or require fake assignments. Keyed the same way regardless
-- (org_id, supplier name), since supplier is a free-text string, not an
-- entity with its own id anywhere in this schema.
--
-- order_channel defaults to 'email' (not 'portal') so an unclassified
-- supplier is conservatively excluded from the Agent View's default
-- "portal suppliers" list rather than silently included.

CREATE TABLE supplier_metadata (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  supplier             TEXT NOT NULL,
  order_channel        TEXT NOT NULL DEFAULT 'email' CHECK (order_channel IN ('portal', 'email', 'phone')),
  portal_name          TEXT,
  search_url_template  TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, supplier)
);

CREATE INDEX idx_supplier_metadata_org_id ON supplier_metadata(org_id);

ALTER TABLE supplier_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "supplier_metadata_all" ON supplier_metadata
  FOR ALL USING (is_org_member(org_id))
  WITH CHECK (is_org_member(org_id));
