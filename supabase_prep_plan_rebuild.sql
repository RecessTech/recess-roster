-- ============================================================
-- R-Shift: Rebuild Prep List as an admin-allocated daily plan
-- ============================================================
-- Replaces the old "flag a component as running low" model
-- (component_prep_flags, left in place unused) with: an admin
-- (Clark/Paddy) builds one shared, org-wide prep plan for today --
-- an ordered list of tasks, each with a qty/uom and a staff
-- assignee -- and staff tick tasks off through the day.
--
-- Tasks are their own catalog (prep_tasks), broader than
-- recipe_components -- plain actions with no shelf-ready output
-- (Wash Lettuce, Cook Chicken, Roast Sweet Potato) alongside actual
-- components (Chicken Avo Mix, Compote, Pesto Dressing). The catalog
-- grows organically: adding a never-seen task from the admin screen
-- creates it here too, so it's there to reuse next time.

CREATE TABLE IF NOT EXISTS prep_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  default_qty NUMERIC,
  default_uom TEXT,
  -- Standing tasks that belong on every day's plan by default (e.g. the
  -- 2 trays of bacon every morning) -- re-seeded onto a day whenever
  -- that day's plan is empty, so it's never something staff have to
  -- remember to add.
  auto_include BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prep_tasks_org ON prep_tasks(org_id);

ALTER TABLE prep_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY prep_tasks_org_access ON prep_tasks
  FOR ALL USING (is_org_member(org_id)) WITH CHECK (is_org_member(org_id));

-- One shared plan per calendar day (no per-location split -- Clark
-- confirmed one list covers both sites). qty/uom are copied from the
-- task's defaults when added, then stand on their own -- editing a
-- task's default later never rewrites a day that already used it.
CREATE TABLE IF NOT EXISTS prep_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  plan_date DATE NOT NULL,
  task_id UUID NOT NULL REFERENCES prep_tasks(id) ON DELETE CASCADE,
  qty NUMERIC,
  uom TEXT,
  assigned_to TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done')),
  completed_at TIMESTAMPTZ,
  completed_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Backs the admin save's upsert-by-task-for-the-day, so re-saving the
  -- plan updates qty/order/assignee in place instead of duplicating.
  CONSTRAINT prep_plan_items_one_task_per_day UNIQUE (org_id, plan_date, task_id)
);

CREATE INDEX IF NOT EXISTS idx_prep_plan_items_org_date ON prep_plan_items(org_id, plan_date);

ALTER TABLE prep_plan_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY prep_plan_items_org_access ON prep_plan_items
  FOR ALL USING (is_org_member(org_id)) WITH CHECK (is_org_member(org_id));

-- Seed catalog with the examples Clark gave, so day one isn't an empty
-- picker. Cook Bacon is the one standing/automatic task.
INSERT INTO prep_tasks (org_id, name, default_qty, default_uom, auto_include, sort_order)
VALUES
  ('788c4cea-50dd-4284-a218-3a971c8b510d', 'Cook Bacon', 2, 'trays', TRUE, 0),
  ('788c4cea-50dd-4284-a218-3a971c8b510d', 'Wash Lettuce', NULL, NULL, FALSE, 1),
  ('788c4cea-50dd-4284-a218-3a971c8b510d', 'Cook Chicken', NULL, NULL, FALSE, 2),
  ('788c4cea-50dd-4284-a218-3a971c8b510d', 'Chicken Avo Mix', NULL, NULL, FALSE, 3),
  ('788c4cea-50dd-4284-a218-3a971c8b510d', 'Compote', NULL, NULL, FALSE, 4),
  ('788c4cea-50dd-4284-a218-3a971c8b510d', 'Pesto Dressing', NULL, NULL, FALSE, 5),
  ('788c4cea-50dd-4284-a218-3a971c8b510d', 'Roast Sweet Potato', NULL, NULL, FALSE, 6)
ON CONFLICT DO NOTHING;
