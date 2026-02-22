import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const PAYMONGO_BASE_URL = 'https://api.paymongo.com/v1';
const CREDIT_TO_PHP_RATE = 90; // 1 credit = 90 PHP

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

    // Get available credits from the Tutors.credits column
    // This column is the source of truth for the net balance.
    let credits = 0;
    if (tutorData.id) {
      // Get total withdrawals that are NOT yet reflected in the Tutors.credits column balance.
      // Completed withdrawals are already subtracted from the column, so we only subtract 
      // those that are pending or being processed.
      const { data: withdrawals } = await supabase
        .from('TutorWithdrawals')
        .select('amount')
        .eq('tutor_id', tutorData.id)
        .in('status', ['pending', 'approved', 'processing']);

      const totalWithdrawnCredits = withdrawals
        ? withdrawals.reduce((total, w) => total + parseFloat(w.amount || 0) / 90, 0)
        : 0;

      // AVAILABLE BALANCE: 
      // Use Tutors.credits minus only the pending/processing withdrawals.
      const manualBalance = parseFloat(tutorData.credits || 0);
      credits = Math.max(0, manualBalance - totalWithdrawnCredits);
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

    // Record withdrawal in database (status: pending - requires superadmin approval)
    const { data: withdrawal, error: withdrawalError } = await supabase
      .from('TutorWithdrawals')
      .insert({
        tutor_id: tutorData.id,
        amount: amountPhp,
        status: 'pending', // Will remain pending until superadmin approves
        payment_method: tutorData.payment_method,
        note: `Cash out request: ${credits} credits = ₱${amountPhp.toFixed(2)} via ${tutorData.payment_method}`,
      })
      .select()
      .single();

    if (withdrawalError) {
      return NextResponse.json(
        { error: `Failed to record withdrawal: ${withdrawalError.message}` },
        { status: 500 }
      );
    }

    // Deduct credits immediately from the tutor's balance
    // They will be refunded if the withdrawal is rejected
    try {
      const newCredits = Math.max(0, (parseFloat(tutorData.credits) || 0) - credits);
      await supabase
        .from('Tutors')
        .update({ credits: newCredits })
        .eq('id', tutorData.id);
      
      console.log(`Deducted ${credits} credits from tutor ${tutorData.id} for cashout request ${withdrawal.id}. New balance: ${newCredits}`);
    } catch (updateError) {
      console.error('Error deducting credits for cashout:', updateError);
      // If deduction fails, we should ideally delete the withdrawal, but for now we'll just log
    }

    // Note: Payout processing will happen ONLY after superadmin approval
    // See /api/admin/withdrawals/process route for actual payout processing

    // Note: In a production system, you would:
    // 1. Use Stripe Connect to create connected accounts for tutors
    // 2. Use Stripe Transfers/Payouts to send money to their accounts
    // 3. OR use PayMongo Payouts API to send money to bank accounts/GCash
    // 4. For now, withdrawals are marked as 'pending' and can be processed manually by admin

    const paymentMethod = tutorData.payment_method === 'bank' 
      ? `Bank Transfer (${tutorData.bank_name})`
      : tutorData.payment_method === 'paypal'
      ? `PayPal (${tutorData.paypal_email})`
      : `GCash (${tutorData.gcash_number})`;

    cashoutResult = {
      success: true,
      withdrawalId: withdrawal.id,
      amountPhp,
      credits,
      source: usedSource,
      paymentMethod,
      status: 'pending',
      message: `Cash out request submitted successfully! Your request for ₱${amountPhp.toFixed(2)} (${credits} credits) will be reviewed by an administrator. You will be notified once it's approved and processed.`,
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

