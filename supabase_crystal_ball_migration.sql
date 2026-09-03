-- ============================================================
-- Crystal Ball: demand forecasting -- schema
-- ============================================================
-- Historical daily sales per menu item (from POS exports for now,
-- a 'channel' column leaves room for other sources later). Feeds a
-- day-of-week historical average as the forecast baseline.

CREATE TABLE sales_history (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  sale_date  DATE NOT NULL,
  item_id    UUID NOT NULL REFERENCES production_items(id) ON DELETE CASCADE,
  channel    TEXT NOT NULL DEFAULT 'pos',
  qty        NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, sale_date, item_id, channel)
);

CREATE INDEX idx_sales_history_org_date ON sales_history(org_id, sale_date);
CREATE INDEX idx_sales_history_item     ON sales_history(item_id);

ALTER TABLE sales_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sales_history_all" ON sales_history
  FOR ALL USING (is_org_member(org_id))
  WITH CHECK (is_org_member(org_id));

-- Since POS data alone undercounts total demand (delivery platforms,
-- B2B, etc. aren't in the Square export), this is a manual % applied
-- on top of the POS-derived day-of-week average.
CREATE TABLE crystal_ball_settings (
  org_id             UUID PRIMARY KEY REFERENCES organisations(id) ON DELETE CASCADE,
  channel_uplift_pct NUMERIC NOT NULL DEFAULT 0,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE crystal_ball_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crystal_ball_settings_all" ON crystal_ball_settings
  FOR ALL USING (is_org_member(org_id))
  WITH CHECK (is_org_member(org_id));
