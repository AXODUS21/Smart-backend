-- Migration script to change name column to first_name and last_name
-- Run this in Supabase SQL Editor

-- Step 1: Add new columns to Students table
ALTER TABLE public."Students" 
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT;

-- Step 2: Migrate existing data in Students table
-- Split existing name into first_name and last_name
UPDATE public."Students"
SET 
  first_name = CASE 
    WHEN name IS NULL OR name = '' THEN ''
    WHEN position(' ' in name) > 0 THEN 
      LEFT(name, position(' ' in name) - 1)
    ELSE name
  END,
  last_name = CASE 
    WHEN name IS NULL OR name = '' THEN ''
    WHEN position(' ' in name) > 0 THEN 
      SUBSTRING(name FROM position(' ' in name) + 1)
    ELSE ''
  END
WHERE first_name IS NULL OR last_name IS NULL;

-- Step 3: Add new columns to Tutors table
ALTER TABLE public."Tutors" 
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT;

-- Step 4: Migrate existing data in Tutors table
-- Split existing name into first_name and last_name
UPDATE public."Tutors"
SET 
  first_name = CASE 
    WHEN name IS NULL OR name = '' THEN ''
    WHEN position(' ' in name) > 0 THEN 
      LEFT(name, position(' ' in name) - 1)
    ELSE name
  END,
  last_name = CASE 
    WHEN name IS NULL OR name = '' THEN ''
    WHEN position(' ' in name) > 0 THEN 
      SUBSTRING(name FROM position(' ' in name) + 1)
    ELSE ''
  END
WHERE first_name IS NULL OR last_name IS NULL;

-- Step 5: (Optional) Drop the old name column after verifying the migration
-- Uncomment these lines after you've verified everything works correctly
-- ALTER TABLE public."Students" DROP COLUMN IF EXISTS name;
-- ALTER TABLE public."Tutors" DROP COLUMN IF EXISTS name;

