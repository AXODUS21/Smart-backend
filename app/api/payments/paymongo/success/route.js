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

    // Redirect based on payment status
    if (status === 'succeeded') {
      // Mark family pack if applicable (idempotent: only sets has_family_pack)
      try {
        let isFamilyPack = false;
        if (planId) {
          const { data: planData } = await supabase
            .from('credit_plans')
            .select('name, slug, is_family_pack')
            .or(`slug.eq.${planId},id.eq.${planId}`)
            .maybeSingle();
          if (planData) {
            const planName = (planData.name || '').toLowerCase();
            const planSlug = (planData.slug || '').toLowerCase();
            isFamilyPack =
              planData.is_family_pack === true ||
              planName.includes('family') ||
              planSlug.includes('family');
          } else {
            const planIdLower = planId.toLowerCase();
            isFamilyPack = planIdLower.includes('family');
          }
        }

        if (isFamilyPack && userId) {
          const { data: studentRow } = await supabase
            .from('Students')
            .select('id')
            .eq('user_id', userId)
            .maybeSingle();

          if (studentRow) {
            await supabase
              .from('Students')
              .update({ has_family_pack: true })
              .eq('user_id', userId);
          } else {
            await supabase.from('Students').insert({
              user_id: userId,
              credits: 0,
              has_family_pack: true,
            });
          }
        }
      } catch (e) {
        console.error('Error setting family pack flag (PayMongo success):', e);
      }

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

