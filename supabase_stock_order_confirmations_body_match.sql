-- ============================================================
-- R-Stock: disambiguate marketplace order-confirmation emails
-- Run this in the R-Shift Supabase project SQL editor, after
-- supabase_stock_order_confirmations_migration.sql
-- ============================================================
-- Some suppliers are ordered directly (Bidfood emails from its own
-- address -- a From match is enough to confirm it). Others go through
-- a marketplace that emails from the SAME address for every supplier
-- it routes -- FoodByUs ("ORDER PLACED: Your Order with FoodByUs",
-- always from noreply@foodbyus.com) and Fresho (orders@fresho.com)
-- both do this. Matching those suppliers on From alone would credit
-- every marketplace order to every supplier that shares that address.
--
-- confirmation_body_match additionally requires this substring to
-- appear in the email body (decoded by the Edge Function, since it's
-- HTML/multipart, not just the From header) -- e.g. 'Black Forest' for
-- Blackforest, 'Fruitique' for Fruitique. A supplier with no
-- confirmation_body_match set is unaffected -- it still matches on
-- From alone, same as before this migration.
--
-- Because a single marketplace email's body can legitimately name more
-- than one supplier (one FoodByUs cart spanning several suppliers),
-- the uniqueness constraint below is widened so one gmail_message_id
-- can produce a confirmation row per matched supplier, not just one
-- per email.

ALTER TABLE supplier_metadata
  ADD COLUMN confirmation_body_match TEXT;

ALTER TABLE supplier_order_confirmations
  DROP CONSTRAINT supplier_order_confirmations_org_id_gmail_message_id_key,
  ADD CONSTRAINT supplier_order_confirmations_org_supplier_msg_key UNIQUE (org_id, supplier, gmail_message_id);
