-- Add columns required for principal sign-up form
-- Run in Supabase SQL Editor if not applied via MCP
ALTER TABLE public."Principals"
  ADD COLUMN IF NOT EXISTS middle_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS contact_number TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS address TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS district_school_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS type_of_school TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS type_of_students JSONB NOT NULL DEFAULT '[]'::jsonb;
