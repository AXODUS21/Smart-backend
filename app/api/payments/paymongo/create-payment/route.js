import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const PAYMONGO_BASE_URL = 'https://api.paymongo.com/v1';

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured');
  }

  if (!serviceRoleKey) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY not found for PayMongo create route, using anon key (may have RLS restrictions)');
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

export async function POST(request) {
  try {
    // Check if PayMongo secret key is configured (check at runtime, not module level)
    const paymongoSecretKey = process.env.PAYMONGO_SECRET_KEY;
    if (!paymongoSecretKey) {
      console.error('PAYMONGO_SECRET_KEY is not configured');
      return NextResponse.json(
        { error: 'PayMongo secret key not configured. Please check your environment variables.' },
        { status: 500 }
      );
    }

    const { planId, userId } = await request.json();

    if (!planId || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    const fetchPlan = async () => {
      let { data: planData, error: planError } = await supabase
        .from('credit_plans')
        .select('id, slug, name, credits, price_usd, savings_percent')
        .eq('slug', planId)
        .eq('is_active', true)
        .maybeSingle();

      if (planError && planError.code !== 'PGRST116') {
        throw planError;
      }

      if (!planData) {
        const { data: byIdData, error: byIdError } = await supabase
          .from('credit_plans')
          .select('id, slug, name, credits, price_usd, savings_percent, is_active')
          .eq('id', planId)
          .eq('is_active', true)
          .maybeSingle();

        if (byIdError && byIdError.code !== 'PGRST116') {
          throw byIdError;
        }

        planData = byIdData;
      }

      return planData;
    };

    const planData = await fetchPlan();

    if (!planData) {
      return NextResponse.json(
        { error: 'Selected credit plan could not be found or is inactive.' },
        { status: 404 }
      );
    }

    const credits = planData.credits;
    const price = parseFloat(planData.price_usd);

    if (!Number.isFinite(price) || price <= 0) {
      return NextResponse.json(
        { error: 'Invalid pricing configured for this credit plan.' },
        { status: 422 }
      );
    }

    // Create a Payment Intent
    // Convert USD to PHP (1 USD = ~56 PHP, or use env variable for rate)
    const usdToPhpRate = parseFloat(process.env.USD_TO_PHP_RATE || '56');
    const amountInPhp = price * usdToPhpRate;
    const amount = Math.round(amountInPhp * 100); // Convert to centavos (PHP cents)

    const paymentIntentResponse = await fetch(`${PAYMONGO_BASE_URL}/payment_intents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Basic ${Buffer.from(paymongoSecretKey + ':').toString('base64')}`,
      },
      body: JSON.stringify({
        data: {
          attributes: {
            amount: amount,
            currency: 'PHP',
            payment_method_allowed: ['card'],
            payment_method_options: {
              card: {
                request_three_d_secure: 'automatic',
              },
            },
            metadata: {
              planId: planData.slug || planData.id,
              credits: credits.toString(),
              userId,
              originalPriceUsd: price.toString(),
            },
          },
        },
      }),
    });

    if (!paymentIntentResponse.ok) {
      const errorData = await paymentIntentResponse.json();
      console.error('PayMongo error:', errorData);
      return NextResponse.json(
        { error: errorData.errors?.[0]?.detail || 'Failed to create payment intent' },
        { status: paymentIntentResponse.status }
      );
    }

    const paymentIntentData = await paymentIntentResponse.json();
    const paymentIntentId = paymentIntentData.data.id;
    const clientKey = paymentIntentData.data.attributes.client_key;

    // Create a Payment Method and attach to Payment Intent
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    
    return NextResponse.json({
      paymentIntentId,
      clientKey,
      publicKey: process.env.NEXT_PUBLIC_PAYMONGO_PUBLIC_KEY,
      successUrl: `${baseUrl}/api/payments/paymongo/success?paymentIntentId=${paymentIntentId}&planId=${encodeURIComponent(planData.slug || planData.id)}&credits=${credits}&userId=${userId}`,
      cancelUrl: `${baseUrl}/?tab=credits&canceled=true`,
    });
  } catch (error) {
    console.error('PayMongo payment creation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create payment' },
      { status: 500 }
    );
  }
}

