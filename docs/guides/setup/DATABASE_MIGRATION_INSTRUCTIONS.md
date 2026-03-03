# Database Migration Instructions

## Required Migration: Add Approval Fields to TutorWithdrawals

Before using the superadmin withdrawal approval feature, you need to run the database migration.

### Step 1: Run the Migration

Go to your Supabase Dashboard:
1. Navigate to **SQL Editor**
2. Copy and paste the contents of `migrations/add_withdrawal_approval_fields.sql`
3. Execute the script

### What the Migration Does

Adds the following fields to the `TutorWithdrawals` table:
- `approved_by` - UUID of superadmin who approved
- `rejected_by` - UUID of superadmin who rejected
- `rejected_at` - Timestamp when rejected
- `rejection_reason` - Reason for rejection
- `processed_at` - Timestamp when payout was processed
- `payout_provider` - Payment provider used (stripe, paymongo, manual)
- `payout_transaction_id` - Transaction ID from payment provider

Updates the status constraint to include:
- `pending` - Waiting for superadmin approval
- `approved` - Approved by superadmin, ready to process
- `processing` - Currently being processed
- `completed` - Successfully paid out
- `rejected` - Rejected by superadmin
- `failed` - Payment processing failed

### Verification

After running the migration, verify it worked:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'TutorWithdrawals' 
AND column_name IN ('approved_by', 'rejected_by', 'processed_at', 'payout_provider');
```

You should see all the new columns listed.

