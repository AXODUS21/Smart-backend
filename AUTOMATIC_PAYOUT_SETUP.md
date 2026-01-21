# Automatic Payout System Setup

## Overview
The system automatically creates payout requests for tutors on the 15th and 30th of each month. Tutors receive credits after completing sessions and submitting reviews, and these are automatically queued for payout twice monthly.

## How It Works

1. **Credit Earning**: Tutors earn credits when they submit a review for completed sessions in the Past Sessions tab
2. **Automatic Payout**: On the 15th and 30th of each month, the system automatically creates payout requests for all tutors with available credits
3. **Superadmin Approval**: Payout requests appear in the Superadmin dashboard and require approval before processing
4. **Payment Processing**: Once approved, the system processes the payment via Stripe or PayMongo

## Setup Instructions

### 1. Run Database Migration
Execute the migration script in Supabase SQL Editor:
```sql
-- See: migrations/add_tutor_payout_tracking.sql
```

### 2. Set Environment Variables
Add to your `.env.local`:
```
CRON_SECRET=your-secure-random-string-here
```

Generate a secure secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Set Up Cron Job

#### Option A: Vercel Cron (Recommended for Vercel deployments)
Add to `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/process-payouts",
    "schedule": "0 0 15,30 * *"
  }]
}
```

#### Option B: External Cron Service (e.g., cron-job.org, EasyCron)
1. Create a cron job that calls: `https://your-domain.com/api/cron/process-payouts`
2. Method: POST
3. Header: `Authorization: Bearer YOUR_CRON_SECRET`
4. Schedule: Twice monthly (15th and 30th at midnight UTC)
   - Cron expression: `0 0 15,30 * *`

### 4. Manual Testing
Test the cron endpoint manually:
```bash
curl -X POST https://your-domain.com/api/cron/process-payouts \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Credit Conversion Rate
- 1 credit = 180 PHP
- 30 minutes session = 1 credit = ₱180
- 1 hour session = 2 credits = ₱360

## Payout Flow

1. **Automatic Processing** (15th & 30th):
   - System calculates available credits for each tutor
   - Creates `TutorWithdrawals` records with status = "pending"
   - Updates tutor's `last_payout_date`

2. **Superadmin Review**:
   - Superadmin views requests in "Withdrawal Requests" tab
   - Can approve or reject each request
   - Rejection requires a reason

3. **Payment Processing**:
   - Upon approval, system initiates payout via Stripe/PayMongo
   - Status updates to "processing" → "completed"
   - Transaction ID recorded for tracking

## Monitoring

View payout history in:
- **Superadmin**: Withdrawal Requests tab
- **Tutor**: Profile → Cash Out section
- **Database**: `TutorWithdrawals` table

## Notes

- Tutors must have valid payment information (bank account, PayPal, or GCash) to receive payouts
- Payouts require superadmin approval for security
- Credits are only counted after tutors submit reviews for completed sessions
- The system prevents double-payments by checking existing withdrawals
