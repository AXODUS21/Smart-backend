-- Add columns to Tutors table for automatic payout tracking
-- Run this in Supabase SQL editor

BEGIN;

-- Add last_payout_date to track when the last automatic payout was processed
ALTER TABLE public."Tutors"
ADD COLUMN IF NOT EXISTS last_payout_date TIMESTAMPTZ;

COMMENT ON COLUMN public."Tutors".last_payout_date IS 'Date of last automatic payout processing';

-- Add columns to TutorWithdrawals if they don't exist
ALTER TABLE public."TutorWithdrawals"
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS payout_provider TEXT,
ADD COLUMN IF NOT EXISTS payout_transaction_id TEXT;

COMMENT ON COLUMN public."TutorWithdrawals".approved_by IS 'Superadmin who approved the withdrawal';
COMMENT ON COLUMN public."TutorWithdrawals".rejected_by IS 'Superadmin who rejected the withdrawal';
COMMENT ON COLUMN public."TutorWithdrawals".rejected_at IS 'Date when withdrawal was rejected';
COMMENT ON COLUMN public."TutorWithdrawals".rejection_reason IS 'Reason for rejection';
COMMENT ON COLUMN public."TutorWithdrawals".processed_at IS 'Date when withdrawal was processed/paid';
COMMENT ON COLUMN public."TutorWithdrawals".payout_provider IS 'Payment provider used (stripe, paymongo)';
COMMENT ON COLUMN public."TutorWithdrawals".payout_transaction_id IS 'Transaction ID from payment provider';

COMMIT;
