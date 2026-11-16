ALTER TABLE prep_tasks
  -- Coarse admin-assigned priority (1 highest, 3 lowest), replacing the
  -- old up/down-arrow-only ordering. flag_order still exists and now
  -- only breaks ties within the same priority (set by drag-and-drop).
  ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 2 CHECK (priority IN (1, 2, 3));
