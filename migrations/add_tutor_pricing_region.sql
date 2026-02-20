-- Adds a pricing_region column to Tutors so we can distinguish between PH and International tutors.
-- Run inside your Supabase/Postgres instance before deploying the new UI.

ALTER TABLE public."Tutors"
ADD COLUMN IF NOT EXISTS pricing_region text CHECK (pricing_region IN ('US', 'PH')) DEFAULT 'US';

-- Update existing records to default to 'US' if null
UPDATE public."Tutors"
SET pricing_region = 'US'
WHERE pricing_region IS NULL;

COMMENT ON COLUMN public."Tutors".pricing_region IS 'Set to PH to use Philippines credit pricing; defaults to US (international).';
