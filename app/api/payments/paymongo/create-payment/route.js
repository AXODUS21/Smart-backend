import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const PAYMONGO_BASE_URL = 'https://api.paymongo.com/v1';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

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

    const { planId, credits, price, userId } = await request.json();

    if (!planId || !credits || !price || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
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
              planId,
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
      successUrl: `${baseUrl}/api/payments/paymongo/success?paymentIntentId=${paymentIntentId}&planId=${planId}&credits=${credits}&userId=${userId}`,
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

