-- Adds a pricing_region column to Students so clients can manually choose credit pricing.
-- Run inside your Supabase/Postgres instance before deploying the new UI.

ALTER TABLE public."Students"
ADD COLUMN IF NOT EXISTS pricing_region text CHECK (pricing_region IN ('US', 'PH')) DEFAULT 'US';

UPDATE public."Students"
SET pricing_region = 'US'
WHERE pricing_region IS NULL;

COMMENT ON COLUMN public."Students".pricing_region IS 'Set to PH to use Philippines credit pricing; defaults to US (international).';







