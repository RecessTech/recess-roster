-- ============================================================
-- R-Recipe: Category-level packaging rules
-- Run this in the R-Shift Supabase project SQL editor
--
-- Depends on:
--   supabase_recipes_migration.sql (recipe_menu_item_lines, stock_items pricing)
--   supabase_production_migration.sql (production_items -- .category)
-- ============================================================

-- ── 1. CATEGORY PACKAGING LINES ───────────────────────────────
-- "Every item in category X gets Y of packaging SKU Z", e.g. all
-- Sandwiches get a Sandwich Tub + Sandwich Lid + Napkin. Applies to
-- every current AND future item in that category with no per-item
-- setup -- category is a plain text match against
-- production_items.category, not a foreign key, since categories
-- are just strings there too. Always a direct SKU line (no
-- components/nesting -- packaging doesn't need batch recipes).

CREATE TABLE category_packaging_lines (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  category      TEXT NOT NULL,
  stock_item_id UUID NOT NULL REFERENCES stock_items(id) ON DELETE RESTRICT,
  qty           NUMERIC NOT NULL DEFAULT 0,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_category_packaging_lines_org_id   ON category_packaging_lines(org_id);
CREATE INDEX idx_category_packaging_lines_category ON category_packaging_lines(org_id, category);
CREATE INDEX idx_category_packaging_lines_stock_item ON category_packaging_lines(stock_item_id);

-- ── 2. MENU ITEM PACKAGING EXCLUSIONS ─────────────────────────
-- Per-item opt-out from one of its category's packaging lines --
-- e.g. one particular Sandwich doesn't get a lid. Extra/different
-- packaging for a single item doesn't need a table of its own: that
-- already works today as an ordinary recipe_menu_item_lines row
-- (any stock item, packaging included, can be added straight to one
-- item's recipe).

CREATE TABLE menu_item_packaging_exclusions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  item_id       UUID NOT NULL REFERENCES production_items(id) ON DELETE CASCADE,
  stock_item_id UUID NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (item_id, stock_item_id)
);

CREATE INDEX idx_menu_item_packaging_exclusions_org_id ON menu_item_packaging_exclusions(org_id);
CREATE INDEX idx_menu_item_packaging_exclusions_item   ON menu_item_packaging_exclusions(item_id);

-- ── 3. ROW LEVEL SECURITY ─────────────────────────────────────

ALTER TABLE category_packaging_lines        ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_item_packaging_exclusions  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "category_packaging_lines_all" ON category_packaging_lines
  FOR ALL USING (is_org_member(org_id))
  WITH CHECK (is_org_member(org_id));

CREATE POLICY "menu_item_packaging_exclusions_all" ON menu_item_packaging_exclusions
  FOR ALL USING (is_org_member(org_id))
  WITH CHECK (is_org_member(org_id));
