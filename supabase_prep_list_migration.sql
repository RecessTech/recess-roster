-- ============================================================
-- Prep List: staff can flag a prep component (recipe_components
-- with type='prep' -- sauces, batters, portioned items someone
-- actually batches, not plain costing lines) as running low, for
-- a given site and "today" or "tomorrow". Mirrors the R-Stock
-- staff-flag pattern (supabase_stock_staff_flag_migration.sql) but
-- deliberately separate: this never touches stock_item_sites or
-- stocktake at all -- it's its own list, cleared by ticking it off
-- rather than by an admin review.
-- Run this in the R-Shift Supabase project SQL editor
-- Depends on: organisations, is_org_member() (supabase-rshift-migration.sql),
-- locations (supabase-stock-migration.sql), recipe_components
-- (supabase_recipes_migration.sql)
-- ============================================================

CREATE TABLE component_prep_flags (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  component_id       UUID NOT NULL REFERENCES recipe_components(id) ON DELETE CASCADE,
  location_id        UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  needed_date        DATE NOT NULL,
  status             TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done')),
  flagged_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  flagged_by_name    TEXT,
  completed_at       TIMESTAMPTZ,
  completed_by_name  TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_component_prep_flags_org_id ON component_prep_flags(org_id);
CREATE INDEX idx_component_prep_flags_open   ON component_prep_flags(org_id, status);

-- Components are bulk-prepped, one-off asks -- re-flagging the same
-- component at the same site while it's already open just refreshes
-- that row (see the edge function's upsert) rather than piling up
-- duplicates on the list.
CREATE UNIQUE INDEX idx_component_prep_flags_open_unique
  ON component_prep_flags(component_id, location_id)
  WHERE status = 'open';

ALTER TABLE component_prep_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "component_prep_flags_all" ON component_prep_flags
  FOR ALL USING (is_org_member(org_id))
  WITH CHECK (is_org_member(org_id));
