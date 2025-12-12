-- Principals table migration
-- Run this script in Supabase SQL editor

BEGIN;

-- Create Principals table
CREATE TABLE IF NOT EXISTS public."Principals" (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL DEFAULT '',
    last_name TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL,
    credits DECIMAL(10, 2) NOT NULL DEFAULT 0,
    pricing_region TEXT NOT NULL DEFAULT 'US' CHECK (pricing_region IN ('US', 'PH')),
    students JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_principals_user_id ON public."Principals"(user_id);

-- Enable RLS (Row Level Security)
ALTER TABLE public."Principals" ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Principals
-- Principals can read their own data
CREATE POLICY "Principals can read own data"
    ON public."Principals"
    FOR SELECT
    USING (auth.uid() = user_id);

-- Principals can update their own data
CREATE POLICY "Principals can update own data"
    ON public."Principals"
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Service role can do everything (for admin operations)
CREATE POLICY "Service role full access"
    ON public."Principals"
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

COMMIT;









