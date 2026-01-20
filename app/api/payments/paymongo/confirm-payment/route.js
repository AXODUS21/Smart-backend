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
        // METHOD 1: Use metadata from PayMongo payment intent (most reliable - set at payment creation)
        let isFamilyPack = false;
        
        if (metadata.isFamilyPack) {
          isFamilyPack = metadata.isFamilyPack === "true";
          console.log("PayMongo: ✅ Using isFamilyPack from payment intent metadata:", isFamilyPack);
        } else if (planId) {
          // METHOD 2: Fallback to database query
          console.log("PayMongo: Checking family pack status for planId:", planId);
          const { data: planData, error: planError } = await supabase
            .from('credit_plans')
            .select('is_family_pack, name, slug')
            .or(`slug.eq.${planId},id.eq.${planId}`)
            .maybeSingle();
          
          if (planError) {
            console.error("PayMongo: Error fetching plan data:", planError);
          }

          if (planData) {
            console.log("PayMongo: Plan data found:", { 
              is_family_pack: planData.is_family_pack, 
              name: planData.name, 
              slug: planData.slug 
            });
            // Use the is_family_pack field first, fallback to checking name/slug
            isFamilyPack = planData.is_family_pack === true;
            if (!isFamilyPack) {
              const planName = (planData.name || '').toLowerCase();
              const planSlug = (planData.slug || '').toLowerCase();
              isFamilyPack = planName.includes('family') || planSlug.includes('family');
            }
            console.log("PayMongo: isFamilyPack determined from database:", isFamilyPack);
          } else {
            console.warn("PayMongo: Plan data not found for planId:", planId);
          }
        } else {
          console.warn("PayMongo: No planId provided in metadata");
        }
        
        console.log("PayMongo: 🎯 FINAL isFamilyPack value:", isFamilyPack);

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

          // If this is a family pack purchase, set has_family_pack for all students under this principal
          if (isFamilyPack) {
            try {
              // Get all students linked to this principal
              const { data: principalWithStudents, error: fetchStudentsError } = await supabase
                .from('Principals')
                .select('students')
                .eq('user_id', userId)
                .single();

              if (!fetchStudentsError && principalWithStudents?.students) {
                const studentIds = principalWithStudents.students
                  .map((s) => s.student_id || s.id)
                  .filter(Boolean);

                if (studentIds.length > 0) {
                  // Update all students to have has_family_pack = true
                  const { error: updateStudentsError } = await supabase
                    .from('Students')
                    .update({ has_family_pack: true })
                    .in('id', studentIds);

                  if (updateStudentsError) {
                    console.error('Error updating student family pack status:', updateStudentsError);
                    // Don't fail the payment, just log the error
                  } else {
                    console.log(`Updated ${studentIds.length} students with family pack status`);
                  }
                }
              }
            } catch (familyPackError) {
              console.error('Error setting family pack for principal students:', familyPackError);
              // Don't fail the payment if this fails
            }
          }
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
              const { data: newStudentData, error: createError } = await supabase
                .from('Students')
                .insert({
                  user_id: userId,
                  credits: credits,
                  has_family_pack: isFamilyPack,
                })
                .select('email, first_name, last_name, has_family_pack')
                .single();
              
              if (createError) {
                console.error("PayMongo: Error creating student record:", createError);
              } else {
                console.log("PayMongo: Student record created:", {
                  has_family_pack: newStudentData?.has_family_pack,
                  isFamilyPack,
                });
                
                // VERIFICATION: Double-check the database
                if (isFamilyPack && newStudentData) {
                  const { data: verifyData, error: verifyError } = await supabase
                    .from('Students')
                    .select('has_family_pack')
                    .eq('user_id', userId)
                    .single();
                  
                  if (verifyError) {
                    console.error("PayMongo: ❌ Verification query failed:", verifyError);
                  } else {
                    if (verifyData?.has_family_pack === true) {
                      console.log("PayMongo: ✅ VERIFICATION SUCCESS: has_family_pack is correctly set to true");
                    } else {
                      console.error("PayMongo: ❌ VERIFICATION FAILED: has_family_pack is NOT set! Current value:", verifyData?.has_family_pack);
                      // Try to fix it directly
                      const { error: fixError } = await supabase
                        .from('Students')
                        .update({ has_family_pack: true })
                        .eq('user_id', userId);
                      
                      if (fixError) {
                        console.error("PayMongo: ❌ Failed to fix has_family_pack:", fixError);
                      } else {
                        console.log("PayMongo: ✅ Fixed has_family_pack by direct update");
                      }
                    }
                  }
                }
              }
              
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
                console.log("PayMongo: ✅ Family pack purchase detected - setting has_family_pack = true");
              } else {
                console.log("PayMongo: ℹ️ Not a family pack purchase - has_family_pack will not be updated");
              }

              console.log("PayMongo: Updating student credits and family pack:", {
                userId,
                currentCredits,
                creditsToAdd: credits,
                newCredits,
                isFamilyPack,
                updateData,
                currentHasFamilyPack: currentData.has_family_pack,
              });

              const { data: updateResult, error: updateError } = await supabase
                .from('Students')
                .update(updateData)
                .eq('user_id', userId)
                .select();

              if (updateError) {
                console.error("PayMongo: Error updating student:", updateError);
              } else {
                console.log("PayMongo: ✅ Student updated successfully:", updateResult);
                if (updateResult && updateResult.length > 0) {
                  console.log("PayMongo: Student record after update:", {
                    id: updateResult[0].id,
                    credits: updateResult[0].credits,
                    has_family_pack: updateResult[0].has_family_pack,
                  });
                  
                  // VERIFICATION: Double-check the database to ensure has_family_pack was set correctly
                  if (isFamilyPack) {
                    const { data: verifyData, error: verifyError } = await supabase
                      .from('Students')
                      .select('has_family_pack')
                      .eq('user_id', userId)
                      .single();
                    
                    if (verifyError) {
                      console.error("PayMongo: ❌ Verification query failed:", verifyError);
                    } else {
                      if (verifyData?.has_family_pack === true) {
                        console.log("PayMongo: ✅ VERIFICATION SUCCESS: has_family_pack is correctly set to true in database");
                      } else {
                        console.error("PayMongo: ❌ VERIFICATION FAILED: has_family_pack is NOT set to true! Current value:", verifyData?.has_family_pack);
                        // Try to fix it directly
                        const { error: fixError } = await supabase
                          .from('Students')
                          .update({ has_family_pack: true })
                          .eq('user_id', userId);
                        
                        if (fixError) {
                          console.error("PayMongo: ❌ Failed to fix has_family_pack:", fixError);
                        } else {
                          console.log("PayMongo: ✅ Fixed has_family_pack by direct update");
                        }
                      }
                    }
                  }
                }
              }
              
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

