-- ── Ordering Module Migration ─────────────────────────────────────────────────
-- Tables: ordering_distributors, ordering_items, order_history

-- 1. Distributors (configurable supply base)
CREATE TABLE ordering_distributors (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ordering_distributors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own distributors"
  ON ordering_distributors FOR ALL
  USING (auth.uid() = user_id);

-- 2. Ordering items (master SKU list for food & drink)
CREATE TABLE ordering_items (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sku               TEXT        NOT NULL,
  default_qty       NUMERIC     NOT NULL DEFAULT 1,
  uom               TEXT        NOT NULL DEFAULT 'units',
  distributor_id    UUID        REFERENCES ordering_distributors(id) ON DELETE SET NULL,
  sort_order        INTEGER     DEFAULT 0,
  -- Live status (updated by kitchen team / manager)
  current_status    TEXT        NOT NULL DEFAULT 'in_stock'
                    CHECK (current_status IN ('in_stock', 'low_stock', 'no_stock', 'order_placed')),
  -- Per-cycle qty override (falls back to default_qty if null)
  current_qty       NUMERIC,
  status_updated_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ordering_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own ordering items"
  ON ordering_items FOR ALL
  USING (auth.uid() = user_id);

-- 3. Order history (snapshot log of each placed order)
CREATE TABLE order_history (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  placed_at     TIMESTAMPTZ DEFAULT now(),
  delivery_date DATE        NOT NULL,
  -- JSONB snapshot: [{sku, qty, uom, distributor_name, item_id}]
  items         JSONB       NOT NULL DEFAULT '[]',
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE order_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own order history"
  ON order_history FOR ALL
  USING (auth.uid() = user_id);
