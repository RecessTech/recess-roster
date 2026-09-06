-- ============================================================
-- Transfer Hub: cross-site stock transfer requests
-- Run this in the R-Shift Supabase project SQL editor
-- Depends on: organisations, locations, stock_items, is_org_member()
-- from supabase-rshift-migration.sql / supabase-stock-migration.sql
-- ============================================================
-- Deliberately its own table, not a status on stock_item_sites.
-- R-Stock's Stocktake tab already has a "Request Transfer" status,
-- but that ties a transfer to whatever a site's current stocktake
-- count says -- mixing "what does the count say" with "what does
-- someone need right now" muddles both. Transfer Hub is a separate,
-- lightweight worklist: any staff member at either site can flag a
-- SKU they need, independent of any stocktake in progress, and it's
-- surfaced as its own top-level app rather than a R-Stock tab.
--
-- v1 is intentionally minimal: no assignment of who actions a
-- request (anyone in the org can), no validation against on-hand
-- stock (agnostic of what R-Stock's counts say), and the source site
-- is picked manually when a request is actioned.

CREATE TABLE transfer_requests (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                 UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  item_id                UUID NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  requesting_location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  quantity               NUMERIC NOT NULL,
  note                   TEXT,
  status                 TEXT NOT NULL DEFAULT 'open'
                           CHECK (status IN ('open', 'fulfilled', 'cancelled')),
  requested_by           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_location_id     UUID REFERENCES locations(id) ON DELETE SET NULL,
  actioned_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actioned_at            TIMESTAMPTZ,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transfer_requests_org_id     ON transfer_requests(org_id);
CREATE INDEX idx_transfer_requests_org_status ON transfer_requests(org_id, status);
CREATE INDEX idx_transfer_requests_item_id    ON transfer_requests(item_id);
CREATE INDEX idx_transfer_requests_req_loc    ON transfer_requests(requesting_location_id);

ALTER TABLE transfer_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transfer_requests_all" ON transfer_requests
  FOR ALL USING (is_org_member(org_id))
  WITH CHECK (is_org_member(org_id));
