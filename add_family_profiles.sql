-- Family profiles support migration
-- Run this script in Supabase SQL editor

BEGIN;

-- Add JSON column to hold extra profiles for an account
ALTER TABLE public."Students"
ADD COLUMN IF NOT EXISTS extra_profiles JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Track which profile is currently active for the account
ALTER TABLE public."Students"
ADD COLUMN IF NOT EXISTS active_profile_id TEXT;

-- Store the profile reference on schedules (sessions)
ALTER TABLE public."Schedules"
ADD COLUMN IF NOT EXISTS profile_id TEXT,
ADD COLUMN IF NOT EXISTS profile_name TEXT;

-- Store the profile reference on assignments
ALTER TABLE public."Assignments"
ADD COLUMN IF NOT EXISTS profile_id TEXT,
ADD COLUMN IF NOT EXISTS profile_name TEXT;

-- Keep optional reference on reviews table if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'Reviews'
  ) THEN
    ALTER TABLE public."Reviews"
    ADD COLUMN IF NOT EXISTS profile_id TEXT,
    ADD COLUMN IF NOT EXISTS profile_name TEXT;
  END IF;
END $$;

COMMIT;

