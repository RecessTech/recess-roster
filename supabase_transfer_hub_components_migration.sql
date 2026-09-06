-- ============================================================
-- Transfer Hub: allow requesting recipe components, not just SKUs
-- Run this in the R-Shift Supabase project SQL editor, after
-- supabase_transfer_hub_migration.sql and supabase_recipes_migration.sql
-- (recipe_components must already exist)
-- ============================================================
-- Staff sometimes need a prepared component transferred between sites
-- (e.g. "Pickled Onion", "Tuna Mix"), not just a raw stock SKU. A
-- transfer request now points at exactly one of stock_items or
-- recipe_components -- the same polymorphic "one of two FKs" pattern
-- recipe_component_lines already uses for stock_item_id/sub_component_id.

ALTER TABLE transfer_requests RENAME COLUMN item_id TO stock_item_id;
ALTER TABLE transfer_requests ALTER COLUMN stock_item_id DROP NOT NULL;

ALTER TABLE transfer_requests ADD COLUMN component_id UUID REFERENCES recipe_components(id) ON DELETE CASCADE;

ALTER TABLE transfer_requests
  ADD CONSTRAINT transfer_requests_item_xor_component
    CHECK ((stock_item_id IS NOT NULL)::int + (component_id IS NOT NULL)::int = 1);

ALTER INDEX idx_transfer_requests_item_id RENAME TO idx_transfer_requests_stock_item_id;
CREATE INDEX idx_transfer_requests_component_id ON transfer_requests(component_id);
