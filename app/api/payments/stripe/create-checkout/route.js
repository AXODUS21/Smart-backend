import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured');
  }

  if (!serviceRoleKey) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY not found for Stripe checkout route, using anon key (may have RLS restrictions)');
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
    // Check if Stripe secret key is configured
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      console.error('STRIPE_SECRET_KEY is not configured');
      return NextResponse.json(
        { error: 'Stripe secret key not configured. Please check your environment variables.' },
        { status: 500 }
      );
    }

    const stripe = new Stripe(stripeSecretKey);
    const { planId, userId } = await request.json();

    if (!planId || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();
    const fetchPlan = async () => {
      let planQuery = supabase
        .from('credit_plans')
        .select('id, slug, name, credits, price_usd, savings_percent, is_family_pack')
        .eq('slug', planId)
        .eq('is_active', true)
        .maybeSingle();

      let { data: planData, error: planError } = await planQuery;

      if (planError && planError.code !== 'PGRST116') {
        throw planError;
      }

      if (!planData) {
        const { data: byIdData, error: byIdError } = await supabase
          .from('credit_plans')
          .select('id, slug, name, credits, price_usd, savings_percent, is_active, is_family_pack')
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

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${planData.name || planData.slug || 'Credits'} (${credits} Credits)`,
              description: 'Tutoring credits purchase',
            },
            unit_amount: Math.round(price * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/payments/stripe/success?session_id={CHECKOUT_SESSION_ID}&planId=${encodeURIComponent(planData.slug || planData.id)}&credits=${credits}&userId=${userId}`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/?tab=credits&canceled=true`,
      metadata: {
        planId: planData.slug || planData.id,
        credits: credits.toString(),
        userId,
        priceUsd: price.toFixed(2),
        isFamilyPack: (planData.is_family_pack === true).toString(), // Store directly in metadata
      },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    console.error('Error details:', {
      message: error.message,
      type: error.type,
      code: error.code,
      statusCode: error.statusCode,
      stack: error.stack,
    });
    return NextResponse.json(
      { 
        error: error.message || 'Failed to create checkout session',
        details: process.env.NODE_ENV === 'development' ? {
          type: error.type,
          code: error.code,
          statusCode: error.statusCode,
        } : undefined,
      },
      { status: 500 }
    );
  }
}

