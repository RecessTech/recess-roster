-- ============================================================
-- R-Cater: add "Deliver By" (customer-requested delivery time),
-- distinct from ready_by ("Pick-Up Time" in the UI -- the
-- kitchen-logistics time the admin sets).
-- ============================================================

ALTER TABLE catering_jobs ADD COLUMN IF NOT EXISTS deliver_by TEXT;
