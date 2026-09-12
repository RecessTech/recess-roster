-- ============================================================
-- Daily Checklists: opening & closing procedures
-- Run this in the R-Shift Supabase project SQL editor
-- Depends on: organisations, production_sites, is_org_member()
-- ============================================================
-- Per-site, per-type (opening/closing) task list. Completed once per
-- calendar day at each site, with a name typed in to sign off -- no
-- login, same as Transfer Hub/Prep List (see checklist site_id scoping:
-- Bourke St and Crown St run different equipment/layouts, so each site
-- gets its own editable list rather than one shared across the org).
--
-- Sign-off is optional-completion: staff can sign off with tasks still
-- unchecked (this is a record of what happened, not a gate on closing
-- the shop), so there's no "all items required" constraint anywhere
-- here -- only the master list.

-- ── 1. CHECKLIST ITEMS (editable master list) ──────────────────
-- Mirrors stock_items/production_items: a flat, admin-editable catalog
-- with sort_order + active soft-delete rather than hard deletes, so
-- retiring a task doesn't break any run that already referenced it.

CREATE TABLE checklist_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  site_id    UUID NOT NULL REFERENCES production_sites(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('opening', 'closing')),
  name       TEXT NOT NULL,
  details    TEXT,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_checklist_items_org_id      ON checklist_items(org_id);
CREATE INDEX idx_checklist_items_site_type   ON checklist_items(site_id, type);
CREATE INDEX idx_checklist_items_site_active ON checklist_items(site_id, type, active);

-- ── 2. CHECKLIST RUNS (one per site + type + calendar day) ──────
-- run_date is the site's own local business day (Australia/Sydney by
-- default, per organisations.timezone) -- computed by the edge
-- function, not Postgres's server-local CURRENT_DATE, so the daily
-- reset actually lands at local midnight rather than UTC midnight.

CREATE TABLE checklist_runs (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  site_id            UUID NOT NULL REFERENCES production_sites(id) ON DELETE CASCADE,
  type               TEXT NOT NULL CHECK (type IN ('opening', 'closing')),
  run_date           DATE NOT NULL,
  notes              TEXT,
  signed_off_at      TIMESTAMPTZ,
  signed_off_by_name TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (site_id, type, run_date)
);

CREATE INDEX idx_checklist_runs_org_id  ON checklist_runs(org_id);
CREATE INDEX idx_checklist_runs_site    ON checklist_runs(site_id, type, run_date);

-- ── 3. CHECKLIST RUN ITEMS (per-task state within a run) ────────
-- name/details are snapshotted from checklist_items at the moment the
-- run is created, so a later wording edit or reorder to the master
-- list never rewrites what a past day's record actually said. item_id
-- is kept as a soft reference (nullable) purely so retired/edited
-- tasks can still be traced back to their origin where they still
-- exist -- it's never required to resolve a run's own content.

CREATE TABLE checklist_run_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  run_id     UUID NOT NULL REFERENCES checklist_runs(id) ON DELETE CASCADE,
  item_id    UUID REFERENCES checklist_items(id) ON DELETE SET NULL,
  name       TEXT NOT NULL,
  details    TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  checked    BOOLEAN NOT NULL DEFAULT FALSE,
  checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_checklist_run_items_org_id ON checklist_run_items(org_id);
CREATE INDEX idx_checklist_run_items_run_id ON checklist_run_items(run_id);

-- ── 4. ROW LEVEL SECURITY ────────────────────────────────────────
-- Same pattern as the rest of the schema. The public /checklists/<token>
-- page never talks to these tables directly -- it goes through the
-- public-checklists edge function, which runs on the service role and
-- bypasses RLS entirely (same as Transfer Hub/Prep List), so no anon
-- policy is needed here.

ALTER TABLE checklist_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_runs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_run_items  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checklist_items_all" ON checklist_items
  FOR ALL USING (is_org_member(org_id))
  WITH CHECK (is_org_member(org_id));

CREATE POLICY "checklist_runs_all" ON checklist_runs
  FOR ALL USING (is_org_member(org_id))
  WITH CHECK (is_org_member(org_id));

CREATE POLICY "checklist_run_items_all" ON checklist_run_items
  FOR ALL USING (is_org_member(org_id))
  WITH CHECK (is_org_member(org_id));

-- ── 5. SEED: Bourke St, from the existing paper checklist ───────
-- Crown St is still being set up operationally, so it gets no items
-- yet -- the public page only lists a site once it has at least one
-- active checklist item, and the admin app lets Crown St's list be
-- added the same way once it's ready.

INSERT INTO checklist_items (org_id, site_id, type, name, details, sort_order) VALUES
  ((SELECT org_id FROM production_sites WHERE name = 'Bourke St'), (SELECT id FROM production_sites WHERE name = 'Bourke St'), 'opening', 'Turn on all lights, including the wall light', 'Switches are under the barista area and near the sink.', 0),
  ((SELECT org_id FROM production_sites WHERE name = 'Bourke St'), (SELECT id FROM production_sites WHERE name = 'Bourke St'), 'opening', 'Set up front fridge', 'Turn on fridge light (button bottom-right); place all product labels and signs in fridge; check all drinks fully stocked — if low, flag for replenishment from the bus stop.', 1),
  ((SELECT org_id FROM production_sites WHERE name = 'Bourke St'), (SELECT id FROM production_sites WHERE name = 'Bourke St'), 'opening', 'Turn on UberEats & DoorDash', 'Ensure devices are charged; alternate charging through the day; update availability frequently.', 2),
  ((SELECT org_id FROM production_sites WHERE name = 'Bourke St'), (SELECT id FROM production_sites WHERE name = 'Bourke St'), 'opening', 'Turn on speaker & charge', 'Charge both speakers; once one is charged, hang it on the hook above the entry door.', 3),
  ((SELECT org_id FROM production_sites WHERE name = 'Bourke St'), (SELECT id FROM production_sites WHERE name = 'Bourke St'), 'opening', 'Turn on coffee machine', 'Press any button to wake from sleep mode.', 4),
  ((SELECT org_id FROM production_sites WHERE name = 'Bourke St'), (SELECT id FROM production_sites WHERE name = 'Bourke St'), 'opening', 'Fill grinder', 'Check date on coffee tub to use oldest roasted coffee first; fill grinder hopper.', 5),
  ((SELECT org_id FROM production_sites WHERE name = 'Bourke St'), (SELECT id FROM production_sites WHERE name = 'Bourke St'), 'opening', 'Calibrate coffee machine', 'Attach full grinder tub, keep lock on; grind through leftover coffee (~two grinds) into bin; unlock, tamp, run calibration shots until both sides pull 25–33 sec.', 6),
  ((SELECT org_id FROM production_sites WHERE name = 'Bourke St'), (SELECT id FROM production_sites WHERE name = 'Bourke St'), 'opening', 'Put out furniture', NULL, 7),
  ((SELECT org_id FROM production_sites WHERE name = 'Bourke St'), (SELECT id FROM production_sites WHERE name = 'Bourke St'), 'opening', 'Sweep the FOH area', NULL, 8),
  ((SELECT org_id FROM production_sites WHERE name = 'Bourke St'), (SELECT id FROM production_sites WHERE name = 'Bourke St'), 'opening', 'Line the FOH bin', NULL, 9),
  ((SELECT org_id FROM production_sites WHERE name = 'Bourke St'), (SELECT id FROM production_sites WHERE name = 'Bourke St'), 'opening', 'Check ice machine', 'Ensure switched on and ice bin is full (runs 24/7).', 10),
  ((SELECT org_id FROM production_sites WHERE name = 'Bourke St'), (SELECT id FROM production_sites WHERE name = 'Bourke St'), 'opening', 'Fill pastry display', NULL, 11),
  ((SELECT org_id FROM production_sites WHERE name = 'Bourke St'), (SELECT id FROM production_sites WHERE name = 'Bourke St'), 'opening', 'Check packaging & FOH stocks', 'Cups, milks, chai, chocolate, etc.', 12),
  ((SELECT org_id FROM production_sites WHERE name = 'Bourke St'), (SELECT id FROM production_sites WHERE name = 'Bourke St'), 'opening', 'Put out water jug & cups', NULL, 13),
  ((SELECT org_id FROM production_sites WHERE name = 'Bourke St'), (SELECT id FROM production_sites WHERE name = 'Bourke St'), 'opening', 'Put out breakfast & toastie menus', NULL, 14),
  ((SELECT org_id FROM production_sites WHERE name = 'Bourke St'), (SELECT id FROM production_sites WHERE name = 'Bourke St'), 'opening', 'Fill up barista water jug', NULL, 15);

INSERT INTO checklist_items (org_id, site_id, type, name, details, sort_order) VALUES
  ((SELECT org_id FROM production_sites WHERE name = 'Bourke St'), (SELECT id FROM production_sites WHERE name = 'Bourke St'), 'closing', 'Wipe down coffee area', NULL, 0),
  ((SELECT org_id FROM production_sites WHERE name = 'Bourke St'), (SELECT id FROM production_sites WHERE name = 'Bourke St'), 'closing', 'Wipe down front counter & customer bench', NULL, 1),
  ((SELECT org_id FROM production_sites WHERE name = 'Bourke St'), (SELECT id FROM production_sites WHERE name = 'Bourke St'), 'closing', 'Sweep FOH area', NULL, 2),
  ((SELECT org_id FROM production_sites WHERE name = 'Bourke St'), (SELECT id FROM production_sites WHERE name = 'Bourke St'), 'closing', 'Check packaging and drinks', 'Flag if restocking required; enter items needed into the tablet.', 3),
  ((SELECT org_id FROM production_sites WHERE name = 'Bourke St'), (SELECT id FROM production_sites WHERE name = 'Bourke St'), 'closing', 'Clean the coffee machine', 'Unscrew both group head covers (keep screws safe); hand wash covers; remove and hand wash group baskets and handles; rescrew covers — don''t overtighten, only until slight resistance; attach cleaning baskets (closed silver pieces on top); add small amount of cleaning powder (white/green cylindrical container) to each; reattach handles and tighten; hold left-most and right-most buttons on each group for several seconds to backflush; ask Clark or Paddy if unsure; once done, swap cleaning baskets back for regular baskets. Leave the machine on.', 4),
  ((SELECT org_id FROM production_sites WHERE name = 'Bourke St'), (SELECT id FROM production_sites WHERE name = 'Bourke St'), 'closing', 'Empty & rinse coffee buckets', NULL, 5),
  ((SELECT org_id FROM production_sites WHERE name = 'Bourke St'), (SELECT id FROM production_sites WHERE name = 'Bourke St'), 'closing', 'Empty knock tube & clean', NULL, 6),
  ((SELECT org_id FROM production_sites WHERE name = 'Bourke St'), (SELECT id FROM production_sites WHERE name = 'Bourke St'), 'closing', 'Take out rubbish & recycling bins', NULL, 7),
  ((SELECT org_id FROM production_sites WHERE name = 'Bourke St'), (SELECT id FROM production_sites WHERE name = 'Bourke St'), 'closing', 'Store coffee beans in tupperware', NULL, 8),
  ((SELECT org_id FROM production_sites WHERE name = 'Bourke St'), (SELECT id FROM production_sites WHERE name = 'Bourke St'), 'closing', 'Wash grinder hopper', NULL, 9),
  ((SELECT org_id FROM production_sites WHERE name = 'Bourke St'), (SELECT id FROM production_sites WHERE name = 'Bourke St'), 'closing', 'Turn off UberEats & DoorDash devices', NULL, 10),
  ((SELECT org_id FROM production_sites WHERE name = 'Bourke St'), (SELECT id FROM production_sites WHERE name = 'Bourke St'), 'closing', 'Connect devices to chargers', NULL, 11),
  ((SELECT org_id FROM production_sites WHERE name = 'Bourke St'), (SELECT id FROM production_sites WHERE name = 'Bourke St'), 'closing', 'Wipe down & bring in outdoor furniture', NULL, 12),
  ((SELECT org_id FROM production_sites WHERE name = 'Bourke St'), (SELECT id FROM production_sites WHERE name = 'Bourke St'), 'closing', 'Remove signs from fridge & wipe down fridge', NULL, 13),
  ((SELECT org_id FROM production_sites WHERE name = 'Bourke St'), (SELECT id FROM production_sites WHERE name = 'Bourke St'), 'closing', 'Pack away cookies & wipe down pastry cabinet', 'Store cookies in an airtight container.', 14),
  ((SELECT org_id FROM production_sites WHERE name = 'Bourke St'), (SELECT id FROM production_sites WHERE name = 'Bourke St'), 'closing', 'Pull down fridge cover & turn light off', 'Don''t turn off the fridge — the fridge light switch is the middle one.', 15),
  ((SELECT org_id FROM production_sites WHERE name = 'Bourke St'), (SELECT id FROM production_sites WHERE name = 'Bourke St'), 'closing', 'Put speaker on charge', NULL, 16),
  ((SELECT org_id FROM production_sites WHERE name = 'Bourke St'), (SELECT id FROM production_sites WHERE name = 'Bourke St'), 'closing', 'Move bread crates to FOH', NULL, 17),
  ((SELECT org_id FROM production_sites WHERE name = 'Bourke St'), (SELECT id FROM production_sites WHERE name = 'Bourke St'), 'closing', 'Sweep floor around coffee area and mop', NULL, 18),
  ((SELECT org_id FROM production_sites WHERE name = 'Bourke St'), (SELECT id FROM production_sites WHERE name = 'Bourke St'), 'closing', 'Empty water jug in sink and rinse', NULL, 19),
  ((SELECT org_id FROM production_sites WHERE name = 'Bourke St'), (SELECT id FROM production_sites WHERE name = 'Bourke St'), 'closing', 'Turn off all lights', 'Including the wall light.', 20);
