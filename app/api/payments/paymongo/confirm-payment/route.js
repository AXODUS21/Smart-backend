import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendCreditPurchaseEmail } from '@/lib/resendHelper';

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
        // Check if this is a family pack purchase
        let isFamilyPack = false;
        if (planId) {
          const { data: planData } = await supabase
            .from('credit_plans')
            .select('name, slug')
            .or(`slug.eq.${planId},id.eq.${planId}`)
            .maybeSingle();
          
          if (planData) {
            const planName = (planData.name || '').toLowerCase();
            const planSlug = (planData.slug || '').toLowerCase();
            isFamilyPack = planName.includes('family') || planSlug.includes('family');
          }
        }

        // Check if user is a principal first
        const { data: principalData, error: principalFetchError } = await supabase
          .from('Principals')
          .select('credits')
          .eq('user_id', userId)
          .maybeSingle();

        if (!principalFetchError && principalData) {
          // User is a principal, update principal credits
          const currentCredits = principalData.credits || 0;
          const newCredits = currentCredits + credits;

          await supabase
            .from('Principals')
            .update({ credits: newCredits })
            .eq('user_id', userId);
        } else {
          // Check if user is a student
          const { data: currentData, error: fetchError } = await supabase
            .from('Students')
            .select('credits, has_family_pack')
            .eq('user_id', userId)
            .maybeSingle();

          if (!fetchError) {
            if (!currentData) {
              // Create student record if it doesn't exist
              const { data: newStudentData } = await supabase
                .from('Students')
                .insert({
                  user_id: userId,
                  credits: credits,
                  has_family_pack: isFamilyPack,
                })
                .select('email, first_name, last_name')
                .single();
              
              // Send credit purchase notification
              if (newStudentData?.email) {
                try {
                  const studentName = `${newStudentData.first_name || ''} ${newStudentData.last_name || ''}`.trim() || 'Student';
                  // Get amount from payment intent or metadata
                  const amountInCentavos = attachData.data.attributes.amount || 0;
                  const originalPriceUsd = parseFloat(metadata.originalPriceUsd || '0');
                  const usdToPhpRate = parseFloat(process.env.USD_TO_PHP_RATE || '56');
                  const amountPhp = originalPriceUsd * usdToPhpRate;
                  const amount = amountInCentavos > 0 
                    ? `₱${(amountInCentavos / 100).toFixed(2)}` 
                    : originalPriceUsd > 0 
                      ? `₱${amountPhp.toFixed(2)}` 
                      : 'N/A';
                  
                  const emailResult = await sendCreditPurchaseEmail(
                    newStudentData.email,
                    studentName,
                    credits,
                    amount,
                    'PayMongo'
                  );
                  
                  if (emailResult.success) {
                    console.log('Credit purchase notification sent successfully');
                  } else {
                    console.error('Failed to send credit purchase notification:', emailResult.error);
                  }
                } catch (notifError) {
                  console.error('Error sending credit purchase notification:', notifError);
                  // Don't fail the payment if notification fails
                }
              }
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
              
              // Send credit purchase notification
              try {
                const { data: studentInfo } = await supabase
                  .from('Students')
                  .select('email, first_name, last_name')
                  .eq('user_id', userId)
                  .single();
                
                if (studentInfo?.email) {
                  const studentName = `${studentInfo.first_name || ''} ${studentInfo.last_name || ''}`.trim() || 'Student';
                  // Get amount from payment intent or metadata
                  const amountInCentavos = attachData.data.attributes.amount || 0;
                  const originalPriceUsd = parseFloat(metadata.originalPriceUsd || '0');
                  const usdToPhpRate = parseFloat(process.env.USD_TO_PHP_RATE || '56');
                  const amountPhp = originalPriceUsd * usdToPhpRate;
                  const amount = amountInCentavos > 0 
                    ? `₱${(amountInCentavos / 100).toFixed(2)}` 
                    : originalPriceUsd > 0 
                      ? `₱${amountPhp.toFixed(2)}` 
                      : 'N/A';
                  
                  const emailResult = await sendCreditPurchaseEmail(
                    studentInfo.email,
                    studentName,
                    credits,
                    amount,
                    'PayMongo'
                  );
                  
                  if (emailResult.success) {
                    console.log('Credit purchase notification sent successfully');
                  } else {
                    console.error('Failed to send credit purchase notification:', emailResult.error);
                  }
                }
              } catch (notifError) {
                console.error('Error sending credit purchase notification:', notifError);
                // Don't fail the payment if notification fails
              }
            }
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

