-- ============================================================
-- R-Stock Step 1: Shared SKU Catalog + Per-Site Assignment
-- Run this in the R-Shift Supabase project SQL editor, after
-- supabase-stock-migration.sql
-- ============================================================
-- stock_items stays a single shared catalog per org (not duplicated
-- per site). stock_item_sites is the join that says which site(s)
-- carry a given item, and — since the same SKU can have a different
-- supplier at each site — each site's own supplier + reference order
-- qty lives on this join, not on the item itself.
--
-- Deliberately NOT included yet: stock status / this-cycle order qty /
-- "ordered" checkbox (Step 2), and purchased-vs-transfer-from-another-
-- site sourcing (Step 3). Both build on top of this without changing
-- what's created here.
--
-- The stock_item_locations / stock_counts tables from the first
-- migration are left in place but unused — nothing here drops them.

ALTER TABLE stock_items
  ADD COLUMN sku TEXT;

CREATE UNIQUE INDEX idx_stock_items_org_sku ON stock_items(org_id, sku) WHERE sku IS NOT NULL;

CREATE TABLE stock_item_sites (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  item_id             UUID NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  location_id         UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  supplier            TEXT,
  reference_order_qty NUMERIC NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (item_id, location_id)
);

CREATE INDEX idx_stock_item_sites_org_id      ON stock_item_sites(org_id);
CREATE INDEX idx_stock_item_sites_item_id     ON stock_item_sites(item_id);
CREATE INDEX idx_stock_item_sites_location_id ON stock_item_sites(location_id);

ALTER TABLE stock_item_sites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_item_sites_all" ON stock_item_sites
  FOR ALL USING (is_org_member(org_id))
  WITH CHECK (is_org_member(org_id));
