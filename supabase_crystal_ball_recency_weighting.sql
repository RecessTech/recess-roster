-- ============================================================
-- Crystal Ball: recency-weighted day-of-week averages
-- ============================================================
-- Every forecast (daily and the Week Ahead rollup) was a flat average
-- of ALL historical same-weekdays -- e.g. "next Tuesday" always used
-- the average of every past Tuesday equally, whether it was yesterday
-- or 8 weeks ago. That's why navigating Week Ahead between future
-- weeks showed identical totals: nothing in the model varied week to
-- week.
--
-- recency_halflife_weeks makes older sales count for less: a sale
-- from one half-life ago counts half as much as one from today, two
-- half-lives ago counts a quarter, etc. 0 = old behaviour (flat
-- average, no recency weighting). Defaults to 4 weeks -- meaningful
-- recent-trend tilt without discarding most of an ~9-week history.
-- Tune per-org from the Forecast tab's "Recency" control.
-- ============================================================

ALTER TABLE crystal_ball_settings
  ADD COLUMN IF NOT EXISTS recency_halflife_weeks NUMERIC NOT NULL DEFAULT 4;

-- ── VERIFY ─────────────────────────────────────────────────────
SELECT org_id, channel_uplift_pct, recency_halflife_weeks FROM crystal_ball_settings;
