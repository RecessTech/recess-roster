-- Add email column to staff table
-- Run once on your Supabase instance

ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS email TEXT;
