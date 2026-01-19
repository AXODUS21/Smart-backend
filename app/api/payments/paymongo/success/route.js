import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const PAYMONGO_BASE_URL = 'https://api.paymongo.com/v1';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const paymentIntentId = searchParams.get('paymentIntentId');
    const planId = searchParams.get('planId');
    const credits = parseInt(searchParams.get('credits'));
    const userId = searchParams.get('userId');

    // Get base URL from request
    const url = new URL(request.url);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${url.protocol}//${url.host}`;

    if (!paymentIntentId) {
      return NextResponse.redirect(
        `${baseUrl}/?tab=credits&error=missing_payment_intent`
      );
    }

    // Check if PayMongo secret key is configured (check at runtime)
    const paymongoSecretKey = process.env.PAYMONGO_SECRET_KEY;
    if (!paymongoSecretKey) {
      console.error('PAYMONGO_SECRET_KEY is not configured');
      return NextResponse.redirect(
        `${baseUrl}/?tab=credits&error=config_error`
      );
    }

    // Retrieve payment intent to check status
    const retrieveResponse = await fetch(
      `${PAYMONGO_BASE_URL}/payment_intents/${paymentIntentId}`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Basic ${Buffer.from(paymongoSecretKey + ':').toString('base64')}`,
        },
      }
    );

    if (!retrieveResponse.ok) {
      return NextResponse.redirect(
        `${baseUrl}/?tab=credits&error=retrieve_error`
      );
    }

    const paymentData = await retrieveResponse.json();
    const status = paymentData.data.attributes.status;

    // If payment succeeded and we haven't updated credits yet, update them
    if (status === 'succeeded' && credits > 0 && userId) {
      // Credit Principals first (principal buys in Add Credits); else Students
      const { data: principalData } = await supabase
        .from('Principals')
        .select('credits, id')
        .eq('user_id', userId)
        .maybeSingle();

      if (principalData) {
        const currentCredits = principalData.credits || 0;
        const newCredits = currentCredits + credits;
        await supabase
          .from('Principals')
          .update({ credits: newCredits })
          .eq('user_id', userId);
      } else {
        const { data: currentData, error: fetchError } = await supabase
          .from('Students')
          .select('credits')
          .eq('user_id', userId)
          .single();

        if (!fetchError && currentData) {
          const currentCredits = currentData?.credits || 0;
          const newCredits = currentCredits + credits;
          await supabase
            .from('Students')
            .update({ credits: newCredits })
            .eq('user_id', userId);
        }
      }
    }

    // Redirect based on payment status
    if (status === 'succeeded') {
      return NextResponse.redirect(
        `${baseUrl}/?tab=credits&success=true&credits=${credits}`
      );
    } else if (status === 'awaiting_payment_method' || status === 'awaiting_next_action') {
      // Payment requires 3DS or additional action
      return NextResponse.redirect(
        `${baseUrl}/?tab=credits&payment_pending=true&paymentIntentId=${paymentIntentId}`
      );
    } else {
      return NextResponse.redirect(
        `${baseUrl}/?tab=credits&error=payment_failed`
      );
    }
  } catch (error) {
    console.error('PayMongo success handler error:', error);
    const url = new URL(request.url);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${url.protocol}//${url.host}`;
    return NextResponse.redirect(
      `${baseUrl}/?tab=credits&error=processing_error`
    );
  }
}

