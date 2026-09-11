-- ============================================================
-- R-Barista: Drinks Guide schema migration
--
-- Procedural, barista-facing step-by-step guides for Coffee & Tea
-- menu items -- R-Builds' sibling for drinks instead of sandwiches.
-- R-Recipe stays the single source of truth for ingredients/quantities;
-- this schema only holds the "how" (method steps), never re-storing
-- the "what" (ingredient names/qty), so a recipe change never leaves
-- a guide's ingredient list out of sync.
--
-- Depends on:
--   supabase-rshift-migration.sql     (organisations, is_org_member())
--   supabase_production_migration.sql (production_items)
-- ============================================================

-- One row per guide *version* for a menu item. Editing a guide never
-- mutates it in place -- saving inserts a new version and archives the
-- previous one, so old guides stay queryable instead of being lost.
CREATE TABLE drink_guides (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  production_item_id  UUID NOT NULL REFERENCES production_items(id) ON DELETE CASCADE,
  version             INTEGER NOT NULL DEFAULT 1,
  active              BOOLEAN NOT NULL DEFAULT TRUE,
  archived_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_drink_guides_org_id ON drink_guides(org_id);
CREATE INDEX idx_drink_guides_item   ON drink_guides(production_item_id);

-- Only one active guide per menu item at a time.
CREATE UNIQUE INDEX idx_drink_guides_one_active_per_item
  ON drink_guides(production_item_id) WHERE active;

-- Ordered procedural steps for a guide (e.g. "Pull a double shot into a
-- 12oz cup", "Steam milk to 55C"). Never holds ingredient quantities --
-- those are read live from recipe_menu_item_lines at render time.
CREATE TABLE drink_guide_steps (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  guide_id          UUID NOT NULL REFERENCES drink_guides(id) ON DELETE CASCADE,
  step_number       INTEGER NOT NULL,
  instruction_text  TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_drink_guide_steps_org_id ON drink_guide_steps(org_id);
CREATE INDEX idx_drink_guide_steps_guide  ON drink_guide_steps(guide_id);

ALTER TABLE drink_guides      ENABLE ROW LEVEL SECURITY;
ALTER TABLE drink_guide_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "drink_guides_all" ON drink_guides
  FOR ALL USING (is_org_member(org_id))
  WITH CHECK (is_org_member(org_id));

CREATE POLICY "drink_guide_steps_all" ON drink_guide_steps
  FOR ALL USING (is_org_member(org_id))
  WITH CHECK (is_org_member(org_id));

-- Public read-only share token for the R-Barista drinks guide, matching
-- the single staff-surface token pattern used by Staff Hub, R-Prod,
-- Transfer Hub, Prep List, Catering and R-Builds -- reuses
-- staff_hub_public_token rather than minting a new one, so it's the
-- same link staff already have for the other public pages.
