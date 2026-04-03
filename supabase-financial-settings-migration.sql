-- Add financial settings columns to business_settings table
-- Run once on your Supabase instance

ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS target_labor_percentage NUMERIC DEFAULT 30,
  ADD COLUMN IF NOT EXISTS superannuation_rate     NUMERIC DEFAULT 11.5;
