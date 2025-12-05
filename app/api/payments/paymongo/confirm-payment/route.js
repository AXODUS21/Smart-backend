import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const PAYMONGO_BASE_URL = 'https://api.paymongo.com/v1';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(request) {
  try {
    // Check if PayMongo secret key is configured (check at runtime)
    const paymongoSecretKey = process.env.PAYMONGO_SECRET_KEY;
    if (!paymongoSecretKey) {
      console.error('PAYMONGO_SECRET_KEY is not configured');
      return NextResponse.json(
        { error: 'PayMongo secret key not configured. Please check your environment variables.' },
        { status: 500 }
      );
    }

    const { paymentIntentId, paymentMethodId } = await request.json();

    if (!paymentIntentId || !paymentMethodId) {
      return NextResponse.json(
        { error: 'Missing payment intent ID or payment method ID' },
        { status: 400 }
      );
    }

    // Attach payment method to payment intent
    const attachResponse = await fetch(
      `${PAYMONGO_BASE_URL}/payment_intents/${paymentIntentId}/attach`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Basic ${Buffer.from(paymongoSecretKey + ':').toString('base64')}`,
        },
        body: JSON.stringify({
          data: {
            attributes: {
              payment_method: paymentMethodId,
            },
          },
        }),
      }
    );

    if (!attachResponse.ok) {
      const errorData = await attachResponse.json();
      console.error('PayMongo attach error:', errorData);
      return NextResponse.json(
        { error: errorData.errors?.[0]?.detail || 'Failed to attach payment method' },
        { status: attachResponse.status }
      );
    }

    const attachData = await attachResponse.json();
    const status = attachData.data.attributes.status;
    const metadata = attachData.data.attributes.metadata || {};

    // If payment is successful, update credits
    if (status === 'succeeded') {
      const credits = parseInt(metadata.credits || '0');
      const userId = metadata.userId;
      const planId = metadata.planId;

      if (credits > 0 && userId) {
        // Check if this is a family pack purchase (prefer explicit flag on credit_plans)
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

        // Get current credits
        const { data: currentData, error: fetchError } = await supabase
          .from('Students')
          .select('credits, has_family_pack')
          .eq('user_id', userId)
          .maybeSingle();

        if (!fetchError) {
          if (!currentData) {
            // Create student record if it doesn't exist
            await supabase
              .from('Students')
              .insert({
                user_id: userId,
                credits: credits,
                has_family_pack: isFamilyPack,
              });
          } else {
            const currentCredits = currentData?.credits || 0;
            const newCredits = currentCredits + credits;
            const updateData = { credits: newCredits };
            
            // If this is a family pack purchase, set has_family_pack to true
            if (isFamilyPack) {
              updateData.has_family_pack = true;
            }

            await supabase
              .from('Students')
              .update(updateData)
              .eq('user_id', userId);
          }
        }
      }
    }

    return NextResponse.json({
      status,
      paymentIntentId,
      nextAction: attachData.data.attributes.next_action,
    });
  } catch (error) {
    console.error('PayMongo confirm payment error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to confirm payment' },
      { status: 500 }
    );
  }
}

