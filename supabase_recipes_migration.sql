-- ============================================================
-- R-Recipe: Recipe & COGS Schema Migration
-- Run this in the R-Shift Supabase project SQL editor
--
-- Depends on:
--   supabase-rshift-migration.sql   (organisations, is_org_member())
--   supabase-stock-migration.sql    (stock_items)
--   supabase_production_migration.sql (production_items)
-- ============================================================

-- ── 1. SKU PRICING ────────────────────────────────────────────
-- Adds pack size/cost to the existing R-Stock SKU catalog so the
-- same SKU list can be costed, not just par-level tracked.
-- cost_per_uom is derived automatically — never entered directly.

ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS pack_size NUMERIC;
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS pack_cost NUMERIC;
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS cost_per_uom NUMERIC
  GENERATED ALWAYS AS (
    CASE WHEN pack_size IS NOT NULL AND pack_size > 0 AND pack_cost IS NOT NULL
      THEN pack_cost / pack_size
      ELSE NULL
    END
  ) STORED;

-- ── 2. RECIPE COMPONENTS ──────────────────────────────────────
-- A named sub-recipe built from SKUs and/or other components
-- (e.g. "Chicken Avo Mix", or a single-ingredient yield/prep like
-- "Chicken (Cooked)"). `type` is purely a UI label — both are
-- costed identically as Batch Cost / Batch Yield.

CREATE TABLE recipe_components (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'recipe' CHECK (type IN ('recipe', 'prep')),
  uom         TEXT NOT NULL DEFAULT 'g',
  batch_yield NUMERIC NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_recipe_components_org_id     ON recipe_components(org_id);
CREATE INDEX idx_recipe_components_org_active ON recipe_components(org_id, active);

-- ── 3. RECIPE COMPONENT LINES ─────────────────────────────────
-- One ingredient line inside a component's batch recipe. Points
-- at exactly one of a raw SKU or another component (nesting).

CREATE TABLE recipe_component_lines (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  component_id     UUID NOT NULL REFERENCES recipe_components(id) ON DELETE CASCADE,
  stock_item_id    UUID REFERENCES stock_items(id) ON DELETE RESTRICT,
  sub_component_id UUID REFERENCES recipe_components(id) ON DELETE RESTRICT,
  qty              NUMERIC NOT NULL DEFAULT 0,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (stock_item_id IS NOT NULL)::int + (sub_component_id IS NOT NULL)::int = 1
  ),
  CHECK (sub_component_id IS DISTINCT FROM component_id)
);

CREATE INDEX idx_recipe_component_lines_org_id       ON recipe_component_lines(org_id);
CREATE INDEX idx_recipe_component_lines_component_id ON recipe_component_lines(component_id);
CREATE INDEX idx_recipe_component_lines_stock_item    ON recipe_component_lines(stock_item_id);
CREATE INDEX idx_recipe_component_lines_sub_component  ON recipe_component_lines(sub_component_id);

-- ── 4. MENU ITEM RECIPE LINES ─────────────────────────────────
-- "Menu item" is the same record R-Prod already plans production
-- against (production_items) — a recipe just adds costed lines
-- and a sell price to it, so COGS/margin show up everywhere that
-- item is used.

ALTER TABLE production_items ADD COLUMN IF NOT EXISTS sell_price NUMERIC;

CREATE TABLE recipe_menu_item_lines (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  item_id       UUID NOT NULL REFERENCES production_items(id) ON DELETE CASCADE,
  stock_item_id UUID REFERENCES stock_items(id) ON DELETE RESTRICT,
  component_id  UUID REFERENCES recipe_components(id) ON DELETE RESTRICT,
  qty           NUMERIC NOT NULL DEFAULT 0,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (stock_item_id IS NOT NULL)::int + (component_id IS NOT NULL)::int = 1
  )
);

CREATE INDEX idx_recipe_menu_item_lines_org_id  ON recipe_menu_item_lines(org_id);
CREATE INDEX idx_recipe_menu_item_lines_item_id ON recipe_menu_item_lines(item_id);
CREATE INDEX idx_recipe_menu_item_lines_stock_item ON recipe_menu_item_lines(stock_item_id);
CREATE INDEX idx_recipe_menu_item_lines_component  ON recipe_menu_item_lines(component_id);

-- ── 5. ROW LEVEL SECURITY ─────────────────────────────────────

ALTER TABLE recipe_components        ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_component_lines   ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_menu_item_lines   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recipe_components_all" ON recipe_components
  FOR ALL USING (is_org_member(org_id))
  WITH CHECK (is_org_member(org_id));

CREATE POLICY "recipe_component_lines_all" ON recipe_component_lines
  FOR ALL USING (is_org_member(org_id))
  WITH CHECK (is_org_member(org_id));

CREATE POLICY "recipe_menu_item_lines_all" ON recipe_menu_item_lines
  FOR ALL USING (is_org_member(org_id))
  WITH CHECK (is_org_member(org_id));
