import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const PAYMONGO_BASE_URL = 'https://api.paymongo.com/v1';

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

// GET /api/tutor/balance - Check balance for both Stripe and PayMongo
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
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

    const creditToPhpRate = 140; // 1 credit = 140 PHP
    const totalPhp = credits * creditToPhpRate;

    // Check Stripe balance (central account)
    let stripeBalance = 0;
    let stripeAvailable = 0;
    let stripePending = 0;
    let stripeError = null;

    try {
      const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
      if (stripeSecretKey) {
        const stripe = new Stripe(stripeSecretKey);
        
        // Get balance from main Stripe account
        const balance = await stripe.balance.retrieve();

        stripeAvailable = balance.available[0]?.amount || 0; // In cents
        stripePending = balance.pending[0]?.amount || 0; // In cents
        stripeBalance = stripeAvailable + stripePending;
        
        // Convert from cents to PHP (assuming USD - may need conversion)
        // Note: Stripe balances are typically in account's default currency (often USD)
        const usdToPhpRate = parseFloat(process.env.USD_TO_PHP_RATE || '56');
        stripeBalance = (stripeBalance / 100) * usdToPhpRate; // Convert cents to dollars, then to PHP
        stripeAvailable = (stripeAvailable / 100) * usdToPhpRate;
        stripePending = (stripePending / 100) * usdToPhpRate;
      }
    } catch (error) {
      console.error('Error fetching Stripe balance:', error);
      stripeError = error.message;
    }

    // Check PayMongo balance (central account)
    // Note: PayMongo doesn't have a direct balance API like Stripe
    // We'll need to track this manually or return a placeholder
    let paymongoBalance = 0;
    let paymongoError = null;

    // For PayMongo, you would typically track balance manually via webhooks
    // or use their payment intent/payout APIs to calculate available balance
    // For now, we'll return a message indicating manual tracking needed

    return NextResponse.json({
      credits,
      creditToPhpRate,
      totalPhp,
      stripe: {
        balance: stripeBalance,
        available: stripeAvailable,
        pending: stripePending,
        error: stripeError,
      },
      paymongo: {
        balance: paymongoBalance,
        error: paymongoError,
        note: 'PayMongo balance tracking requires manual implementation via webhooks',
      },
    });
  } catch (error) {
    console.error('Error in balance check:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check balance' },
      { status: 500 }
    );
  }
}

