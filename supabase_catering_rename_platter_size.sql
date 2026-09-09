-- ============================================================
-- R-Cater: rename sambos_ppl -> platter_size
--
-- "Sambos (ppl)" read as an odd/internal label in the UI; renamed
-- to "Platter Size" (still headcount -- pieces are computed from
-- platter_size × pieces_per_person, not stored). Only needed if
-- you applied supabase_catering_migration.sql before this rename;
-- a fresh install already gets platter_size from that file.
-- ============================================================

ALTER TABLE catering_jobs RENAME COLUMN sambos_ppl TO platter_size;
