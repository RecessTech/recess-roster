-- ============================================================
-- Packaging Inventory System — Supabase Migration
-- Run this in your Supabase SQL Editor (Database > SQL Editor)
-- ============================================================

-- 1. Packaging items master list
CREATE TABLE IF NOT EXISTS packaging_items (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL,
  name        TEXT NOT NULL,
  sku_code    TEXT,                        -- matches PCK1-PCK4 codes in your Google Sheet
  unit        TEXT DEFAULT 'units',        -- e.g. 'units', 'sleeves', 'packs'
  reorder_level  INTEGER DEFAULT 0,        -- alert when stock drops below this
  reorder_qty    INTEGER DEFAULT 0,        -- suggested order quantity
  notes       TEXT,
  color       TEXT DEFAULT '#6366f1',
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Inventory events (stocktakes + inbound deliveries)
CREATE TABLE IF NOT EXISTS packaging_inventory (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id            UUID NOT NULL,
  packaging_item_id  UUID NOT NULL REFERENCES packaging_items(id) ON DELETE CASCADE,
  type               TEXT NOT NULL CHECK (type IN ('stocktake', 'inbound')),
  date               DATE NOT NULL,
  quantity           INTEGER NOT NULL,
  notes              TEXT,
  supplier           TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Row-level security
ALTER TABLE packaging_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE packaging_inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own packaging items" ON packaging_items;
CREATE POLICY "Users manage own packaging items" ON packaging_items
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own packaging inventory" ON packaging_inventory;
CREATE POLICY "Users manage own packaging inventory" ON packaging_inventory
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Helpful indexes
CREATE INDEX IF NOT EXISTS idx_packaging_items_user ON packaging_items(user_id);
CREATE INDEX IF NOT EXISTS idx_packaging_inventory_user ON packaging_inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_packaging_inventory_item ON packaging_inventory(packaging_item_id);
CREATE INDEX IF NOT EXISTS idx_packaging_inventory_date ON packaging_inventory(date DESC);
