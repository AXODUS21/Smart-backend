# Tutor Payment & Cash Out System

## Overview

This document explains how tutors receive money when they cash out their credits. The system now includes:

1. **Payment Information Management** - Tutors can add their bank, PayPal, or GCash details
2. **Cash Out Flow** - Tutors automatically receive payout requests every 15 days (15th and 30th of each month). Credits are converted to PHP (1 credit = 90 PHP)
3. **Payment Processing** - System validates payment info and processes payouts

## Current Implementation

### 1. Payment Information Fields (Database)

Tutors can store payment information in the `Tutors` table:
- `payment_method`: "bank", "paypal", or "gcash"
- **Bank Transfer**: `bank_account_name`, `bank_account_number`, `bank_name`, `bank_branch`
- **PayPal**: `paypal_email`
- **GCash**: `gcash_number`, `gcash_name`

### 2. UI Components

**Tutor Profile Page** includes:
- Credits display showing available credits and PHP equivalent
- Payment Information section where tutors can add/edit their payment details
- Cash Out button (disabled if payment info is missing)

### 3. Cash Out Process

1. Tutor clicks "Cash Out Credits"
2. System validates:
   - Credits are available (> 0)
   - Payment information is complete
3. System creates a withdrawal record in `TutorWithdrawals` table
4. Credits are automatically deducted (calculated dynamically)
5. Withdrawal is marked as "pending" for admin processing

## For Production / Live System

### Option 1: Stripe Connect (Recommended)

**For Bank Transfers:**
1. Set up Stripe Connect in your Stripe account
2. Create connected accounts for each tutor when they add payment info
3. Use Stripe Transfers to send money to connected accounts
4. Tutors can receive money directly in their bank accounts

**Implementation Steps:**
```javascript
// When tutor adds bank info, create Stripe Connect account
const account = await stripe.accounts.create({
  type: 'express',
  country: 'PH',
  email: tutor.email,
});

// Link bank account
await stripe.accounts.createExternalAccount(account.id, {
  external_account: {
    object: 'bank_account',
    country: 'PH',
    currency: 'php',
    account_number: tutor.bank_account_number,
    // ... other bank details
  },
});

// Process payout
await stripe.transfers.create({
  amount: amountInCentavos,
  currency: 'php',
  destination: account.id,
});
```

### Option 2: PayMongo Payouts API

**For Bank/GCash Transfers:**
1. Use PayMongo Payouts API to send money directly to bank accounts or GCash
2. Requires tutor's account details (already stored)
3. Creates payouts that are processed automatically

**Implementation Steps:**
```javascript
// Create a payout via PayMongo
const payoutResponse = await fetch(`${PAYMONGO_BASE_URL}/payouts`, {
  method: 'POST',
  headers: {
    'Authorization': `Basic ${Buffer.from(PAYMONGO_SECRET_KEY + ':').toString('base64')}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    data: {
      attributes: {
        amount: amountInCentavos,
        currency: 'PHP',
        description: `Payout for tutor ${tutorId}`,
        // Bank or GCash details
      },
    },
  }),
});
```

### Option 3: Manual Processing (Current)

**For now, the system:**
1. Records all withdrawal requests in `TutorWithdrawals` table
2. Marks them as "pending"
3. Admin can manually process payments through:
   - Bank transfers using the stored account details
   - PayPal using the stored email
   - GCash using the stored number

**Admin Dashboard Query:**
```sql
SELECT 
  t.id,
  t.first_name,
  t.last_name,
  t.email,
  tw.amount,
  tw.requested_at,
  tw.status,
  t.payment_method,
  t.bank_account_name,
  t.bank_account_number,
  t.bank_name,
  t.paypal_email,
  t.gcash_number,
  t.gcash_name
FROM "TutorWithdrawals" tw
JOIN "Tutors" t ON tw.tutor_id = t.id
WHERE tw.status = 'pending'
ORDER BY tw.requested_at DESC;
```

## Security Considerations

1. **Encryption**: Payment information should be encrypted at rest
2. **PCI Compliance**: If storing full bank account numbers, ensure PCI compliance
3. **Access Control**: Only tutors should see/edit their own payment info
4. **Verification**: Consider adding admin verification step before processing large payouts

## Environment Variables Needed

For production, ensure these are set:
```env
STRIPE_SECRET_KEY=sk_live_...
PAYMONGO_SECRET_KEY=sk_live_...
USD_TO_PHP_RATE=56
```

## Testing

1. Add payment information in tutor profile
2. Verify cash out button becomes enabled
3. Request cash out
4. Check `TutorWithdrawals` table for pending withdrawal
5. Process manually or via API integration

## Next Steps for Production

1. **Integrate Stripe Connect** or **PayMongo Payouts API** in `/api/tutor/cashout/route.js`
2. **Add webhook handlers** to update withdrawal status automatically
3. **Create admin dashboard** to view and process pending withdrawals
4. **Add email notifications** when payouts are processed
5. **Implement verification** for large payouts

## Current Status

✅ Payment information fields added to database  
✅ UI for managing payment information created  
✅ Cash out validation (checks payment info exists)  
✅ Withdrawal records created in database  
⏳ **Pending**: Actual payout processing via Stripe/PayMongo APIs




