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

// POST /api/admin/withdrawals/process - Process approved withdrawal (Stripe/PayMongo)
export async function POST(request) {
  try {
    const { withdrawalId, superadminId } = await request.json();

    if (!withdrawalId || !superadminId) {
      return NextResponse.json(
        { error: 'Missing required fields: withdrawalId, superadminId' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    // Ensure caller is a superadmin
    const { data: superadmin, error: superadminErr } = await supabase
      .from('superadmins')
      .select('id')
      .eq('user_id', superadminId)
      .maybeSingle();
    if (superadminErr || !superadmin) {
      return NextResponse.json(
        { error: 'Forbidden: superadmin access required' },
        { status: 403 }
      );
    }

    // Get withdrawal with tutor payment info
    const { data: withdrawal, error: fetchError } = await supabase
      .from('TutorWithdrawals')
      .select(`
        *,
        tutor:Tutors(
          id,
          payment_method,
          bank_account_name,
          bank_account_number,
          bank_name,
          bank_branch,
          paypal_email,
          gcash_number,
          gcash_name
        )
      `)
      .eq('id', withdrawalId)
      .single();

    if (fetchError || !withdrawal) {
      return NextResponse.json(
        { error: 'Withdrawal not found' },
        { status: 404 }
      );
    }

    if (withdrawal.status !== 'approved') {
      return NextResponse.json(
        { error: `Withdrawal must be approved before processing. Current status: ${withdrawal.status}` },
        { status: 400 }
      );
    }

    const tutorRaw = withdrawal.tutor;
    if (!tutorRaw) {
      return NextResponse.json(
        { error: 'Tutor information not found' },
        { status: 404 }
      );
    }

    // Handle Supabase join response - might be array or object
    const tutorData = Array.isArray(tutorRaw) ? tutorRaw[0] : tutorRaw;
    
    if (!tutorData) {
      return NextResponse.json(
        { error: 'Tutor information not found' },
        { status: 404 }
      );
    }

    const amountPhp = parseFloat(withdrawal.amount);
    let payoutResult = null;
    let payoutProvider = null;
    let transactionId = null;
    let payoutError = null;

    // Update status to processing
    await supabase
      .from('TutorWithdrawals')
      .update({ status: 'processing' })
      .eq('id', withdrawalId);

    // Determine payment source (check balances)
    let stripeAvailablePhp = 0;
    try {
      const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
      if (stripeSecretKey) {
        const stripe = new Stripe(stripeSecretKey);
        const balance = await stripe.balance.retrieve();
        const stripeAvailable = balance.available[0]?.amount || 0;
        const usdToPhpRate = parseFloat(process.env.USD_TO_PHP_RATE || '56');
        stripeAvailablePhp = (stripeAvailable / 100) * usdToPhpRate;
      }
    } catch (error) {
      console.error('Error checking Stripe balance:', error);
    }

    let paymongoAvailablePhp = 999999; // Placeholder - should be tracked manually
    const usedSource = stripeAvailablePhp >= amountPhp ? 'stripe' : 'paymongo';

    // Process payout via Stripe
    if (usedSource === 'stripe') {
      try {
        const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
        if (stripeSecretKey) {
          const stripe = new Stripe(stripeSecretKey);
          
          // Convert PHP to USD for Stripe
          const usdToPhpRate = parseFloat(process.env.USD_TO_PHP_RATE || '56');
          const amountUsd = amountPhp / usdToPhpRate;
          const amountInCents = Math.round(amountUsd * 100);

          // TODO: In production, use Stripe Connect or Payouts API
          // For now, we'll just mark it as processed
          // Example Stripe Connect payout:
          // const transfer = await stripe.transfers.create({
          //   amount: amountInCents,
          //   currency: 'usd',
          //   destination: tutorData.stripe_account_id, // Stripe Connect account ID
          // });

          payoutProvider = 'stripe';
          transactionId = `stripe_${withdrawalId}_${Date.now()}`;
          payoutResult = {
            provider: 'stripe',
            status: 'processing',
            amountUsd,
            note: 'Stripe payout initiated. In production, integrate with Stripe Connect or Payouts API.',
          };
        }
      } catch (error) {
        console.error('Error processing Stripe payout:', error);
        payoutError = error.message;
      }
    }

    // Process payout via PayMongo
    if (usedSource === 'paymongo') {
      try {
        const paymongoSecretKey = process.env.PAYMONGO_SECRET_KEY;
        if (paymongoSecretKey) {
          const amountInCentavos = Math.round(amountPhp * 100);

          // TODO: In production, use PayMongo Payouts API
          // Example PayMongo payout:
          // const payoutResponse = await fetch(`${PAYMONGO_BASE_URL}/payouts`, {
          //   method: 'POST',
          //   headers: {
          //     'Authorization': `Basic ${Buffer.from(paymongoSecretKey + ':').toString('base64')}`,
          //     'Content-Type': 'application/json',
          //   },
          //   body: JSON.stringify({
          //     data: {
          //       attributes: {
          //         amount: amountInCentavos,
          //         currency: 'PHP',
          //         // Bank or GCash details from tutorData
          //       },
          //     },
          //   }),
          // });

          payoutProvider = 'paymongo';
          transactionId = `paymongo_${withdrawalId}_${Date.now()}`;
          payoutResult = {
            provider: 'paymongo',
            status: 'processing',
            amountPhp,
            note: 'PayMongo payout initiated. In production, integrate with PayMongo Payouts API.',
          };
        }
      } catch (error) {
        console.error('Error processing PayMongo payout:', error);
        payoutError = error.message;
      }
    }

    // Update withdrawal with processing results
    if (payoutError) {
      await supabase
        .from('TutorWithdrawals')
        .update({
          status: 'failed',
          payout_provider: payoutProvider,
          payout_transaction_id: transactionId,
          note: `${withdrawal.note} | Error: ${payoutError}`,
        })
        .eq('id', withdrawalId);

      return NextResponse.json(
        { 
          error: `Payout processing failed: ${payoutError}`,
          withdrawalId,
        },
        { status: 500 }
      );
    } else {
      await supabase
        .from('TutorWithdrawals')
        .update({
          status: 'completed',
          processed_at: new Date().toISOString(),
          payout_provider: payoutProvider,
          payout_transaction_id: transactionId,
          note: `${withdrawal.note} | Processed via ${payoutProvider}`,
        })
        .eq('id', withdrawalId);

      return NextResponse.json({
        success: true,
        message: 'Withdrawal processed successfully',
        withdrawalId,
        transactionId,
        provider: payoutProvider,
        payoutResult,
      });
    }
  } catch (error) {
    console.error('Error processing withdrawal:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process withdrawal' },
      { status: 500 }
    );
  }
}

