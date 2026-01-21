-- Create PayoutReports table for storing automatic payout reports
-- Run this in Supabase SQL Editor

BEGIN;

CREATE TABLE IF NOT EXISTS public."PayoutReports" (
    id BIGSERIAL PRIMARY KEY,
    report_period_start DATE NOT NULL,
    report_period_end DATE NOT NULL,
    report_type TEXT NOT NULL DEFAULT 'automatic_payout' CHECK (report_type IN ('automatic_payout', 'manual_payout')),
    generation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_payouts INTEGER NOT NULL DEFAULT 0,
    total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    successful_payouts INTEGER NOT NULL DEFAULT 0,
    failed_payouts INTEGER NOT NULL DEFAULT 0,
    pending_payouts INTEGER NOT NULL DEFAULT 0,
    report_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on generation_date for faster queries
CREATE INDEX IF NOT EXISTS idx_payout_reports_generation_date ON public."PayoutReports"(generation_date DESC);
CREATE INDEX IF NOT EXISTS idx_payout_reports_period ON public."PayoutReports"(report_period_start, report_period_end);

-- Enable RLS (Row Level Security)
ALTER TABLE public."PayoutReports" ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only service role and superadmins can access
CREATE POLICY "Service role full access to payout reports"
    ON public."PayoutReports"
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Add comments
COMMENT ON TABLE public."PayoutReports" IS 'Stores reports generated for automatic payout processing';
COMMENT ON COLUMN public."PayoutReports".report_period_start IS 'Start date of the payout period (e.g., January 15, 2024)';
COMMENT ON COLUMN public."PayoutReports".report_period_end IS 'End date of the payout period (e.g., January 30, 2024)';
COMMENT ON COLUMN public."PayoutReports".report_type IS 'Type of payout report: automatic_payout or manual_payout';
COMMENT ON COLUMN public."PayoutReports".report_data IS 'JSONB object containing detailed payout information for each tutor';
COMMENT ON COLUMN public."PayoutReports".total_amount IS 'Total amount in PHP for all payouts in this period';

COMMIT;

