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
      .select('id, stripe_account_id, paymongo_account_id, credits, pricing_region')
      .eq('user_id', userId)
      .single();

    if (tutorError || !tutorData) {
      return NextResponse.json(
        { error: 'Tutor not found' },
        { status: 404 }
      );
    }

    // The Tutors.credits column is the absolute source of truth for the available balance.
    // It is incremented on session completion and decremented on payout/withdrawal initiation.
    // If a withdrawal is rejected, it is incremented again.
    const credits = parseFloat(tutorData.credits || 0);

    const creditToPhpRate = 90;
    const creditToUsdRate = 1.5;
    const isInternational = tutorData.pricing_region !== 'PH';
    const totalAmount = credits * (isInternational ? creditToUsdRate : creditToPhpRate);
    const currency = isInternational ? 'USD' : 'PHP';

    // Check Stripe balance (central account) - DISABLED for security/privacy
    // Tutors should not see the platform's balance.
    const stripeBalance = 0;
    const stripeAvailable = 0;
    const stripePending = 0;
    const stripeError = null;

    // Check PayMongo balance (central account) - DISABLED
    const paymongoBalance = 0;
    const paymongoError = null;

    return NextResponse.json({
      credits,
      creditToPhpRate,
      creditToUsdRate,
      totalAmount,
      currency,
      isInternational,
      stripe: {
        balance: stripeBalance,
        available: stripeAvailable,
        pending: stripePending,
        error: stripeError,
      },
      paymongo: {
        balance: paymongoBalance,
        error: paymongoError,
        note: 'Balance tracking disabled for tutor view',
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

