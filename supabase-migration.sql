-- Migration: Add soft-delete support for staff members
-- Run this in the Supabase SQL Editor before deploying

-- Add active column to staff table (defaults to true for all existing records)
ALTER TABLE staff ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- Create index for efficient filtering of active staff
CREATE INDEX IF NOT EXISTS idx_staff_user_active ON staff(user_id, active);
