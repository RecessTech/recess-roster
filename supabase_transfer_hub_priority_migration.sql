-- Transfer Hub: priority field, so staff can flag a request as urgent.
-- Selected as High/Low when making a request; the open-requests overview
-- sorts High to the top.

ALTER TABLE transfer_requests
  ADD COLUMN priority TEXT NOT NULL DEFAULT 'low' CHECK (priority IN ('high', 'low'));
