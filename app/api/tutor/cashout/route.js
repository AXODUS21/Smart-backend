import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const PAYMONGO_BASE_URL = 'https://api.paymongo.com/v1';
const CREDIT_TO_PHP_RATE = 140; // 1 credit = 140 PHP

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured');
  }
  
  return createClient(
    supabaseUrl,
    serviceRoleKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

// POST /api/tutor/cashout - Process cash out request
export async function POST(request) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    // Get tutor data including payment information
    const { data: tutorData, error: tutorError } = await supabase
      .from('Tutors')
      .select('id, stripe_account_id, paymongo_account_id, payment_method, bank_account_name, bank_account_number, bank_name, bank_branch, paypal_email, gcash_number, gcash_name')
      .eq('user_id', userId)
      .single();

    if (tutorError || !tutorData) {
      return NextResponse.json(
        { error: 'Tutor not found' },
        { status: 404 }
      );
    }

    // Calculate credits dynamically from confirmed sessions (same as dashboard)
    let credits = 0;
    if (tutorData.id) {
      const { data: sessions } = await supabase
        .from('Schedules')
        .select('credits_required, status')
        .eq('tutor_id', tutorData.id);

      if (sessions) {
        const totalCreditsEarned = sessions
          .filter((s) => s.status === 'confirmed')
          .reduce((total, session) => total + parseFloat(session.credits_required || 0), 0);

        // Get total withdrawals (convert PHP to credits)
        const { data: withdrawals } = await supabase
          .from('TutorWithdrawals')
          .select('amount')
          .eq('tutor_id', tutorData.id)
          .in('status', ['pending', 'approved', 'completed']);

        const totalWithdrawnCredits = withdrawals
          ? withdrawals.reduce((total, w) => total + parseFloat(w.amount || 0) / 140, 0)
          : 0;

        credits = Math.max(0, totalCreditsEarned - totalWithdrawnCredits);
      }
    }
    
    if (credits <= 0) {
      return NextResponse.json(
        { error: 'No credits available to cash out' },
        { status: 400 }
      );
    }

    // Validate payment information exists
    const hasBankInfo = tutorData.payment_method === 'bank' && 
      tutorData.bank_account_number && 
      tutorData.bank_account_name && 
      tutorData.bank_name;
    
    const hasPayPalInfo = tutorData.payment_method === 'paypal' && tutorData.paypal_email;
    
    const hasGCashInfo = tutorData.payment_method === 'gcash' && 
      tutorData.gcash_number && 
      tutorData.gcash_name;

    if (!hasBankInfo && !hasPayPalInfo && !hasGCashInfo) {
      return NextResponse.json(
        { 
          error: 'Payment information is required. Please add your payment details in your profile before cashing out.',
          requiresPaymentInfo: true
        },
        { status: 400 }
      );
    }

    const amountPhp = credits * CREDIT_TO_PHP_RATE;
    const amountInCents = Math.round(amountPhp * 100); // Convert to centavos for PHP

    let cashoutResult = null;
    let usedSource = null;

    // Check Stripe balance first
    let stripeAvailablePhp = 0;
    try {
      const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
      if (stripeSecretKey) {
        const stripe = new Stripe(stripeSecretKey);
        const balance = await stripe.balance.retrieve();
        const stripeAvailable = balance.available[0]?.amount || 0; // In cents
        const usdToPhpRate = parseFloat(process.env.USD_TO_PHP_RATE || '56');
        stripeAvailablePhp = (stripeAvailable / 100) * usdToPhpRate;
      }
    } catch (error) {
      console.error('Error checking Stripe balance:', error);
    }

    // For PayMongo, we'll assume there's balance (since there's no direct API)
    // In production, you'd track this via webhooks or manual updates
    let paymongoAvailablePhp = 999999; // Placeholder - should be tracked manually

    // Try Stripe first if it has enough balance
    if (stripeAvailablePhp >= amountPhp) {
      usedSource = 'stripe';
    } else if (paymongoAvailablePhp >= amountPhp) {
      // Use PayMongo if Stripe doesn't have enough
      usedSource = 'paymongo';
    } else {
      // Neither has enough - try to split or fail
      const totalAvailable = stripeAvailablePhp + paymongoAvailablePhp;
      if (totalAvailable >= amountPhp) {
        // Use both sources
        usedSource = 'both';
      } else {
        return NextResponse.json(
          { 
            error: 'Insufficient balance in payment accounts. Please contact support.',
            availableStripe: stripeAvailablePhp,
            required: amountPhp,
          },
          { status: 400 }
        );
      }
    }

    // Record withdrawal in database first
    const { data: withdrawal, error: withdrawalError } = await supabase
      .from('TutorWithdrawals')
      .insert({
        tutor_id: tutorData.id,
        amount: amountPhp,
        status: 'pending',
        note: `Cash out (${credits} credits) via ${usedSource} - ${tutorData.payment_method}`,
      })
      .select()
      .single();

    if (withdrawalError) {
      return NextResponse.json(
        { error: `Failed to record withdrawal: ${withdrawalError.message}` },
        { status: 500 }
      );
    }

    // Process actual payout based on payment method
    let payoutResult = null;
    let payoutError = null;

    try {
      if (usedSource === 'stripe' || usedSource === 'both') {
        // For Stripe, create a payout or transfer
        // Note: In production, you'd use Stripe Connect or create a payout to the tutor's bank
        const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
        if (stripeSecretKey) {
          const stripe = new Stripe(stripeSecretKey);
          
          // Convert PHP to USD for Stripe (assuming USD payouts)
          const usdToPhpRate = parseFloat(process.env.USD_TO_PHP_RATE || '56');
          const amountUsd = amountPhp / usdToPhpRate;
          const amountInCents = Math.round(amountUsd * 100);

          // For now, we'll just record it. In production, you would:
          // 1. Create a Stripe Connect account for the tutor, OR
          // 2. Create a payout/transfer to their bank account
          
          payoutResult = {
            provider: 'stripe',
            status: 'pending',
            note: 'Payout will be processed via Stripe. In production, integrate with Stripe Connect or Payouts API.',
          };
        }
      }

      if (usedSource === 'paymongo' || usedSource === 'both') {
        // For PayMongo, create a payout
        // Note: PayMongo has a Payouts API for sending money to bank accounts or GCash
        const paymongoSecretKey = process.env.PAYMONGO_SECRET_KEY;
        if (paymongoSecretKey) {
          // In production, you would use PayMongo Payouts API
          // Example: Create a payout to the tutor's bank account or GCash
          
          payoutResult = {
            provider: 'paymongo',
            status: 'pending',
            note: 'Payout will be processed via PayMongo. In production, integrate with PayMongo Payouts API.',
          };
        }
      }

      // Update withdrawal with payout information
      await supabase
        .from('TutorWithdrawals')
        .update({
          note: `${withdrawal.note} | Payout: ${JSON.stringify(payoutResult)}`,
        })
        .eq('id', withdrawal.id);

    } catch (error) {
      console.error('Error processing payout:', error);
      payoutError = error.message;
      // Don't fail the withdrawal - admin can process manually if needed
    }

    // Note: In a production system, you would:
    // 1. Use Stripe Connect to create connected accounts for tutors
    // 2. Use Stripe Transfers/Payouts to send money to their accounts
    // 3. OR use PayMongo Payouts API to send money to bank accounts/GCash
    // 4. For now, withdrawals are marked as 'pending' and can be processed manually by admin

    cashoutResult = {
      success: true,
      withdrawalId: withdrawal.id,
      amountPhp,
      credits,
      source: usedSource,
      status: 'pending',
      message: `Cash out request submitted. Your withdrawal will be processed via ${usedSource === 'both' ? 'Stripe and PayMongo' : usedSource}.`,
    };

    return NextResponse.json(cashoutResult);
  } catch (error) {
    console.error('Error in cash out:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process cash out' },
      { status: 500 }
    );
  }
}

