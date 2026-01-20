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
      // Check if this is a family pack purchase
      let isFamilyPack = false;
      if (planId) {
        const { data: planData } = await supabase
          .from('credit_plans')
          .select('is_family_pack, name, slug')
          .or(`slug.eq.${planId},id.eq.${planId}`)
          .maybeSingle();
        
        if (planData) {
          // Use the is_family_pack field first, fallback to checking name/slug
          isFamilyPack = planData.is_family_pack === true;
          if (!isFamilyPack) {
            const planName = (planData.name || '').toLowerCase();
            const planSlug = (planData.slug || '').toLowerCase();
            isFamilyPack = planName.includes('family') || planSlug.includes('family');
          }
        }
      }

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

        // If this is a family pack purchase, set has_family_pack for all students under this principal
        if (isFamilyPack) {
          try {
            const { data: principalWithStudents } = await supabase
              .from('Principals')
              .select('students')
              .eq('user_id', userId)
              .single();

            if (principalWithStudents?.students) {
              const studentIds = principalWithStudents.students
                .map((s) => s.student_id || s.id)
                .filter(Boolean);

              if (studentIds.length > 0) {
                await supabase
                  .from('Students')
                  .update({ has_family_pack: true })
                  .in('id', studentIds);
              }
            }
          } catch (err) {
            console.error('Error setting family pack for principal students:', err);
          }
        }
      } else {
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

