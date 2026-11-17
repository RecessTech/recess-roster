-- ============================================================
-- Crystal Ball: forecast fix (Nov 2026)
-- ============================================================
-- recency_halflife_weeks was added by supabase_crystal_ball_recency_weighting.sql
-- but that migration was never run in production, so the engine has been
-- using a flat average of all history (and saving "Recency" failed).
--
-- trend_enabled switches the per-item x weekday trend line back on.
-- It defaults to OFF: backtested on 21 Sep -- 15 Nov 2026, counting
-- zero-sale days + a 4-week half-life + no trend cut item-level error
-- from 33.6% to 28.1% (weekdays) and the bias from +11.5% to about -3%.
-- Safe to re-run.
-- ============================================================

ALTER TABLE crystal_ball_settings
  ADD COLUMN IF NOT EXISTS recency_halflife_weeks NUMERIC NOT NULL DEFAULT 4;

ALTER TABLE crystal_ball_settings
  ADD COLUMN IF NOT EXISTS trend_enabled BOOLEAN NOT NULL DEFAULT FALSE;
