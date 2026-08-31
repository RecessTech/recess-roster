-- ============================================================
-- R-Stock: Order History + Midnight Auto-Archive
-- Run this in the R-Shift Supabase project SQL editor, after
-- supabase-stock-migration-5.sql
-- ============================================================
-- Every night at local (Australia/Sydney) midnight, any stock_item_sites
-- row currently flagged "ordered" is snapshotted into stock_order_history,
-- then ordered/ordered_at/order_qty are reset so the next day starts clean.
-- current_status is intentionally left untouched — that's a physical
-- stocktake flag, not tied to the daily order cycle.

-- ── 1. ORDER HISTORY ─────────────────────────────────────────

CREATE TABLE stock_order_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  item_id         UUID NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  location_id     UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  supplier        TEXT,
  order_qty       NUMERIC,
  status_at_order TEXT,
  ordered_date    DATE NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stock_order_history_org_id ON stock_order_history(org_id);
CREATE INDEX idx_stock_order_history_lookup ON stock_order_history(item_id, location_id, ordered_date DESC);

ALTER TABLE stock_order_history ENABLE ROW LEVEL SECURITY;

-- Read-only from the app's side — rows are written only by the archive
-- function below, which runs with elevated privileges on its own schedule.
CREATE POLICY "stock_order_history_select" ON stock_order_history
  FOR SELECT USING (is_org_member(org_id));

-- ── 2. ARCHIVE FUNCTION ──────────────────────────────────────

CREATE OR REPLACE FUNCTION archive_and_reset_stock_orders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Scheduled hourly below, but only does anything at the local Sydney
  -- midnight hour — this keeps it correct across the AEST/AEDT
  -- daylight-saving switch without ever needing the cron schedule
  -- itself to change.
  IF EXTRACT(hour FROM (now() AT TIME ZONE 'Australia/Sydney')) <> 0 THEN
    RETURN;
  END IF;

  INSERT INTO stock_order_history (org_id, item_id, location_id, supplier, order_qty, status_at_order, ordered_date)
  SELECT org_id, item_id, location_id, supplier, order_qty, current_status,
         ((now() AT TIME ZONE 'Australia/Sydney')::date - INTERVAL '1 day')::date
  FROM stock_item_sites
  WHERE ordered = true;

  UPDATE stock_item_sites
  SET ordered = false, ordered_at = NULL, order_qty = NULL, updated_at = NOW()
  WHERE ordered = true;
END;
$$;

-- ── 3. SCHEDULE ───────────────────────────────────────────────
-- Requires the pg_cron extension. On Supabase this is a supported,
-- one-line enable — no separate infrastructure to stand up.

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'archive-stock-orders-hourly',
  '0 * * * *',
  $$SELECT archive_and_reset_stock_orders();$$
);
