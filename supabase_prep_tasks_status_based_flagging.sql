-- ============================================================
-- R-Shift: Replace day-dated Prep List plan with a persistent
-- status per task (Urgent / Running Low / all-good) -- same shape
-- as R-Stock's own Stock Check flagging, no date/day granularity.
-- prep_plan_items is left in place but unused going forward (same
-- as component_prep_flags from the earlier Prep List model).
-- ============================================================

ALTER TABLE prep_tasks
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'low', 'urgent')),
  ADD COLUMN IF NOT EXISTS flag_qty NUMERIC,
  ADD COLUMN IF NOT EXISTS flag_uom TEXT,
  ADD COLUMN IF NOT EXISTS assigned_to TEXT,
  ADD COLUMN IF NOT EXISTS note TEXT,
  ADD COLUMN IF NOT EXISTS needed_by DATE,
  -- One-shot: honoured by exactly the next reset, then cleared back to
  -- false by that same reset -- so a task surviving two resets in a row
  -- needs the button pressed again, rather than staying flagged forever
  -- by accident.
  ADD COLUMN IF NOT EXISTS carry_forward BOOLEAN NOT NULL DEFAULT FALSE,
  -- Priority order among currently-flagged tasks (admin-adjustable via
  -- up/down arrows), separate from sort_order which is the catalog's own
  -- browse order used when walking the full task list to flag things.
  ADD COLUMN IF NOT EXISTS flag_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS flagged_at TIMESTAMPTZ;

-- Tracks the last local calendar day the reset ran, so it's applied
-- lazily on the first request past local midnight (same pattern this
-- app already uses for "today" everywhere else) rather than needing a
-- cron job.
ALTER TABLE organisations
  ADD COLUMN IF NOT EXISTS prep_last_reset_date DATE;
