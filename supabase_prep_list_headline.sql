ALTER TABLE organisations
  -- An optional note set from Set Plan, shown at the top of the Plan tab
  -- for the day (e.g. "Check all labels before dispatch"). No note -> the
  -- banner doesn't render at all. Single value, same org-wide-state
  -- pattern as prep_last_reset_date -- no day/date granularity, same as
  -- the rest of the flag-based Prep List redesign.
  ADD COLUMN IF NOT EXISTS prep_headline TEXT;
