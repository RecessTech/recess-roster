-- Unify the staff "running low" signal into a tiered field, so Transfer
-- Hub's existing Flag Low Stock and the new Stock Check feature write to
-- one shared signal instead of two parallel mechanisms. Deliberately kept
-- separate from current_status (the admin's own call) -- same precedent
-- as the boolean field this replaces.
ALTER TABLE stock_item_sites ADD COLUMN staff_flag_level TEXT CHECK (staff_flag_level IN ('low', 'order_soon'));

UPDATE stock_item_sites SET staff_flag_level = 'low' WHERE staff_flagged_low = true;

ALTER TABLE stock_item_sites DROP COLUMN staff_flagged_low;

-- SKU Groups: admin-curated, named lists of SKUs for the mobile EOD stock
-- check (e.g. "Bus Stop", "FOH") -- independent of stock_items.category,
-- which is a broad supplier/accounting code, not a role-based checklist.
CREATE TABLE sku_groups (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sku_group_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   UUID NOT NULL REFERENCES sku_groups(id) ON DELETE CASCADE,
  item_id    UUID NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (group_id, item_id)
);

CREATE INDEX idx_sku_group_items_group_id ON sku_group_items(group_id);
