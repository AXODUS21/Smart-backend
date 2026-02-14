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
    const checkoutSessionId = searchParams.get('checkout_session_id');
    const ref = searchParams.get('ref');

    console.log('Payment Success Route Hit:', {
      paymentIntentId,
      planId,
      credits,
      userId,
      checkoutSessionId, // This might be null if using ref approach
      ref
    });

    // Get base URL from request
    const url = new URL(request.url);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${url.protocol}//${url.host}`;

    if (!paymentIntentId && !checkoutSessionId && !ref) {
      console.error('Missing payment identifier');
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

    let status;
    let finalPaymentIntentId = paymentIntentId;
    let effectiveCheckoutSessionId = checkoutSessionId;

    // If we have a reference but no session ID, look it up in user metadata
    if (!effectiveCheckoutSessionId && ref && userId) {
        console.log('Looking up session ID from user metadata using ref:', ref);
        const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
        
        if (userError || !userData.user) {
            console.error('Failed to fetch user data for session lookup:', userError);
        } else {
            const meta = userData.user.user_metadata || {};
            if (meta.paymongo_pending_ref === ref) {
                effectiveCheckoutSessionId = meta.paymongo_pending_session_id;
                console.log('Found session ID in metadata:', effectiveCheckoutSessionId);
                
                // Optional: Clear the metadata to prevent replay (maybe do this after success?)
                // keeping it for now in case of refresh
            } else {
                console.warn('Reference mismatch or not found in metadata:', {
                    expected: ref,
                    actual: meta.paymongo_pending_ref
                });
            }
        }
    }

    if (effectiveCheckoutSessionId) {
      console.log('Retrieving Checkout Session:', effectiveCheckoutSessionId);
      // Retrieve checkout session
      const sessionResponse = await fetch(
        `${PAYMONGO_BASE_URL}/checkout_sessions/${effectiveCheckoutSessionId}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Authorization': `Basic ${Buffer.from(paymongoSecretKey + ':').toString('base64')}`,
          },
        }
      );

      if (!sessionResponse.ok) {
        console.error('Failed to retrieve checkout session', await sessionResponse.text());
        return NextResponse.redirect(
          `${baseUrl}/?tab=credits&error=retrieve_session_error`
        );
      }

      const sessionData = await sessionResponse.json();
      console.log('Checkout Session Data:', JSON.stringify(sessionData, null, 2));
      const session = sessionData.data.attributes;
      
      // Get payment intent from session
      const paymentIntentIdFromSession = session.payment_intent?.id;
      if (paymentIntentIdFromSession) {
         finalPaymentIntentId = paymentIntentIdFromSession;
         console.log('Found Payment Intent from Session:', finalPaymentIntentId);
         
         const piResponse = await fetch(
            `${PAYMONGO_BASE_URL}/payment_intents/${paymentIntentIdFromSession}`,
            {
              method: 'GET',
              headers: {
                'Accept': 'application/json',
                'Authorization': `Basic ${Buffer.from(paymongoSecretKey + ':').toString('base64')}`,
              },
            }
          );
          if (piResponse.ok) {
             const piData = await piResponse.json();
             status = piData.data.attributes.status;
             console.log('Payment Intent Status:', status);
          } else {
             console.error('Failed to retrieve payment intent details');
          }
      } else {
        // If no payment intent is attached yet, check session status directly (e.g., if it's paid)
        console.log('No Payment Intent attached to session yet. Checking session payment intent object.');
         if (session.payment_intent) {
             status = session.payment_intent.attributes.status;
             console.log('Payment Intent Status from Session Object:', status);
         } else {
             console.log('No payment intent info found in session attributes');
         }
      }
    } else {
        console.log('Retrieving Payment Intent directly:', paymentIntentId);
        // Retrieve payment intent directly
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
        console.error('Failed to retrieve payment intent');
        return NextResponse.redirect(
            `${baseUrl}/?tab=credits&error=retrieve_error`
        );
        }

        const paymentData = await retrieveResponse.json();
        status = paymentData.data.attributes.status;
        console.log('Direct Payment Intent Status:', status);
    }

    console.log('Processing credit update...', { status, credits, userId });

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

      console.log('Is Family Pack:', isFamilyPack);

      // Credit Principals first (principal buys in Add Credits); else Students
      const { data: principalData } = await supabase
        .from('Principals')
        .select('credits, id')
        .eq('user_id', userId)
        .maybeSingle();

      console.log('Principal Data Found:', !!principalData);

      if (principalData) {
        const currentCredits = principalData.credits || 0;
        const newCredits = currentCredits + credits;
        const { error: updateError } = await supabase
          .from('Principals')
          .update({ credits: newCredits })
          .eq('user_id', userId);
        
        if (updateError) console.error('Error updating principal credits:', updateError);
        else console.log('Principal credits updated to:', newCredits);

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
                console.log('Updated family pack for students:', studentIds);
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
            console.log('Creating new student record');
            // Create student record if it doesn't exist
            await supabase
              .from('Students')
              .insert({
                user_id: userId,
                credits: credits,
                has_family_pack: isFamilyPack,
              });
          } else {
            console.log('Updating existing student record');
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
        } else {
            console.error('Error fetching student data:', fetchError);
        }
      }
    } else {
        console.warn('Skipping credit update. Conditions not met:', {
            statusSucceeded: status === 'succeeded',
            creditsValid: credits > 0,
            hasUserId: !!userId
        });
    }

    // Redirect based on payment status
    if (status === 'succeeded') {
      return NextResponse.redirect(
        `${baseUrl}/?tab=credits&success=true&credits=${credits}`
      );
    } else if (status === 'awaiting_payment_method' || status === 'awaiting_next_action') {
      // Payment requires 3DS or additional action
      return NextResponse.redirect(
        `${baseUrl}/?tab=credits&payment_pending=true&paymentIntentId=${finalPaymentIntentId || ''}`
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

