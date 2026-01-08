-- Add approval fields to TutorWithdrawals table
ALTER TABLE public."TutorWithdrawals" 
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS payout_provider TEXT,
ADD COLUMN IF NOT EXISTS payout_transaction_id TEXT;

-- Update status check constraint to include new statuses
ALTER TABLE public."TutorWithdrawals" 
DROP CONSTRAINT IF EXISTS "TutorWithdrawals_status_check";

ALTER TABLE public."TutorWithdrawals" 
ADD CONSTRAINT "TutorWithdrawals_status_check" 
CHECK (status IN ('pending', 'approved', 'rejected', 'processing', 'completed', 'failed'));

-- Add comments
COMMENT ON COLUMN public."TutorWithdrawals".approved_by IS 'Superadmin user_id who approved the withdrawal';
COMMENT ON COLUMN public."TutorWithdrawals".rejected_by IS 'Superadmin user_id who rejected the withdrawal';
COMMENT ON COLUMN public."TutorWithdrawals".rejected_at IS 'Timestamp when withdrawal was rejected';
COMMENT ON COLUMN public."TutorWithdrawals".rejection_reason IS 'Reason for rejection';
COMMENT ON COLUMN public."TutorWithdrawals".processed_at IS 'Timestamp when payout was processed';
COMMENT ON COLUMN public."TutorWithdrawals".payout_provider IS 'Payment provider used: stripe, paymongo, or manual';
COMMENT ON COLUMN public."TutorWithdrawals".payout_transaction_id IS 'Transaction ID from payment provider';

