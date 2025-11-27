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

    // Get tutor data
    const { data: tutorData, error: tutorError } = await supabase
      .from('Tutors')
      .select('id, stripe_account_id, paymongo_account_id')
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

    // Record withdrawal in database
    const { data: withdrawal, error: withdrawalError } = await supabase
      .from('TutorWithdrawals')
      .insert({
        tutor_id: tutorData.id,
        amount: amountPhp,
        status: 'pending',
        note: `Cash out (${credits} credits) via ${usedSource}`,
      })
      .select()
      .single();

    if (withdrawalError) {
      return NextResponse.json(
        { error: `Failed to record withdrawal: ${withdrawalError.message}` },
        { status: 500 }
      );
    }

    // Note: We don't reset credits to 0 here because credits are calculated dynamically
    // from sessions minus withdrawals. The withdrawal record is enough.

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

