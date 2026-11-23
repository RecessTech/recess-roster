ALTER TABLE organisations
  -- Tracks the last local date Stock Check's staff flags were cleared,
  -- same lazy-reset pattern as prep_last_reset_date -- no cron job, just
  -- a check on the first request past local midnight.
  ADD COLUMN IF NOT EXISTS stock_check_last_reset_date DATE;
