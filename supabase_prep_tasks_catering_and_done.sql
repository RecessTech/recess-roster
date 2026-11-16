ALTER TABLE prep_tasks
  DROP COLUMN IF EXISTS needed_by,
  ADD COLUMN IF NOT EXISTS catering BOOLEAN NOT NULL DEFAULT FALSE,
  -- Ticking a task done no longer clears its flag -- it stays on the
  -- Plan, struck through, until the next reset clears it like any other
  -- unflagged-via-reset task. Separate from status so an admin editing
  -- qty/note on an already-done task doesn't accidentally un-tick it.
  ADD COLUMN IF NOT EXISTS done BOOLEAN NOT NULL DEFAULT FALSE;
