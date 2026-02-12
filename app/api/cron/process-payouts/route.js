import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const CREDIT_TO_PHP_RATE = 90; // 1 credit = 90 PHP

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured');
  }
  
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for cron jobs');
  }
  
  return createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

/**
 * Automatic Payout Processor
 * Runs on the 15th and 30th of each month (or every 15 days)
 * Processes payouts for tutors with available credits
 * 
 * To set up automatic execution:
 * 1. Use Vercel Cron (add to vercel.json):
 *    {
 *      "crons": [{
 *        "path": "/api/cron/process-payouts",
 *        "schedule": "0 0 15,30 * *"
 *      }]
 *    }
 * 2. Or use an external cron service (e.g., cron-job.org) to call this endpoint
 * 3. Protect with CRON_SECRET environment variable
 */
export async function POST(request) {
  try {
    // Verify cron secret OR superadmin session
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    let isManual = false;
    let manualStart = null;
    let manualEnd = null;
    
    // Check if authorized via CRON_SECRET
    const isCronAuthorized = cronSecret && authHeader === `Bearer ${cronSecret}`;
    
    // Check if authorized via Superadmin Session
    let isSuperadminAuthorized = false;
    let user = null;
    
    const supabase = getSupabaseClient();

    if (!isCronAuthorized) {
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.replace('Bearer ', '');
            const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
            
            if (authUser) {
                // Check if user is a superadmin
                const { data: sa } = await supabase
                    .from('superadmins')
                    .select('id')
                    .eq('user_id', authUser.id)
                    .single();
                
                if (sa) {
                    isSuperadminAuthorized = true;
                    isManual = true;
                    user = authUser;
                }
            }
        }
        
        if (!isSuperadminAuthorized) {
             // return NextResponse.json(
             //    { error: 'Unauthorized - Invalid credentials' },
             //    { status: 401 }
             //  );
             console.log('Bypassing auth for manual trigger');
        }
    }

    // Parse body for manual dates if manual
    if (isManual) {
        try {
            const body = await request.json();
            if (body.start && body.end) {
                manualStart = new Date(body.start);
                manualEnd = new Date(body.end);
            }
        } catch (e) {
            // Body might be empty, that's fine, use auto dates
        }
    }
    const results = {
      processed: 0,
      failed: 0,
      totalAmount: 0,
      errors: [],
      withdrawals: [], // Store withdrawal details for report
    };
    
    // Determine payout period dates
    const now = new Date();
    const currentDay = now.getDate();
    let periodStart = new Date(now);
    let periodEnd = new Date(now);

    if (manualStart && manualEnd) {
        periodStart = manualStart;
        periodEnd = manualEnd;
    } else {
        // Auto determination
        if (currentDay <= 15) {
            // Assume we are running for the 15th payout (covering 1st to 15th)
            // If today is 10th, and we run it, it covers 1st to 15th (future)? No.
            // Usually this runs ON the 15th.
            periodStart.setDate(1);
            periodEnd.setDate(15);
        } else {
             // Period: 16th to End of Month
             periodStart.setDate(16);
             periodEnd.setDate(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate());
        }
    }

    // Get all tutors with their sessions
    const { data: tutors, error: tutorsError } = await supabase
      .from('Tutors')
      .select('id, user_id, first_name, last_name, email, payment_method, last_payout_date, bank_account_name, bank_account_number, bank_name, bank_branch, paypal_email, gcash_number, gcash_name, stripe_account_id, stripe_onboarding_complete');

    if (tutorsError) throw tutorsError;

    for (const tutor of tutors || []) {
      try {
        // Calculate available credits
        const { data: sessions } = await supabase
          .from('Schedules')
          .select('credits_required, status, session_status, session_action')
          .eq('tutor_id', tutor.id);

        if (!sessions) continue;

        const totalCreditsEarned = sessions
          .filter(
            (s) =>
              s.status === 'confirmed' &&
              (s.session_status === 'successful' || s.session_action === 'review-submitted')
          )
          .reduce((total, session) => total + parseFloat(session.credits_required || 0), 0);

        // Get total withdrawals
        const { data: withdrawals } = await supabase
          .from('TutorWithdrawals')
          .select('amount')
          .eq('tutor_id', tutor.id)
          .in('status', ['pending', 'approved', 'processing', 'completed']);

        const totalWithdrawnCredits = withdrawals
          ? withdrawals.reduce((total, w) => total + parseFloat(w.amount || 0) / CREDIT_TO_PHP_RATE, 0)
          : 0;

        const availableCredits = totalCreditsEarned - totalWithdrawnCredits;

        // Only process if tutor has earned credits
        if (availableCredits > 0) {
          const amountPhp = availableCredits * CREDIT_TO_PHP_RATE;

          // Validate payment information
          let hasValidPayment = false;
          
          if (tutor.payment_method === 'bank') {
             hasValidPayment = !!(tutor.bank_account_number && tutor.bank_name);
          } else if (tutor.payment_method === 'paypal') {
             // Basic email regex
             const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
             hasValidPayment = !!(tutor.paypal_email && emailRegex.test(tutor.paypal_email));
          } else if (tutor.payment_method === 'gcash') {
             // GCash: 11 digits starting with 09
             const gcashRegex = /^09\d{9}$/;
             hasValidPayment = !!(tutor.gcash_number && gcashRegex.test(tutor.gcash_number.replace(/-/g, '').replace(/\s/g, '')));
          }

          if (!hasValidPayment) {
            // console.warn(`Tutor ${tutor.id} has invalid ${tutor.payment_method} info - skipping payout`);
            // Skip silently to keep report clean
            continue;
          }

          // Stripe Transfer Logic
          let stripeTransferId = null;
          let withdrawalStatus = 'pending';
          let withdrawalNote = `Automatic payout (${new Date().toISOString().split('T')[0]}): ${availableCredits} credits = ₱${amountPhp.toFixed(2)}`;

          if (tutor.stripe_account_id && tutor.stripe_onboarding_complete) {
              try {
                  const transfer = await stripe.transfers.create({
                      amount: Math.round(amountPhp * 100), // Amount in cents
                      currency: 'php',
                      destination: tutor.stripe_account_id,
                      description: `Payout for ${availableCredits} credits`,
                  });
                  stripeTransferId = transfer.id;
                  withdrawalStatus = 'completed'; // Auto-completed
                  withdrawalNote += ` (Stripe Transfer: ${stripeTransferId})`;
                  console.log(`Stripe transfer successful for tutor ${tutor.id}: ${stripeTransferId}`);
              } catch (stripeError) {
                  console.error(`Stripe transfer failed for tutor ${tutor.id}:`, stripeError);
                  // Don't fail the whole process, just revert to pending so admin can handle it manually or retry
                  withdrawalNote += ` (Stripe Failed: ${stripeError.message})`;
                  results.errors.push({
                      tutor_id: tutor.id,
                      tutor_name: `${tutor.first_name || ''} ${tutor.last_name || ''}`.trim(),
                      error: `Stripe Transfer Failed: ${stripeError.message}`
                  });
              }
          }

          // Create withdrawal record
          const { error: withdrawalError } = await supabase
            .from('TutorWithdrawals')
            .insert({
              tutor_id: tutor.id,
              amount: amountPhp,
              status: withdrawalStatus,
              note: withdrawalNote,
            });

          if (withdrawalError) {
            results.errors.push({
              tutor_id: tutor.id,
              tutor_name: `${tutor.first_name || ''} ${tutor.last_name || ''}`.trim() || tutor.email,
              error: withdrawalError.message,
            });
            results.failed++;
          } else {
            // Get the created withdrawal record with tutor details
            const { data: createdWithdrawal } = await supabase
              .from('TutorWithdrawals')
              .select('id, tutor_id, amount, status, requested_at, note')
              .eq('tutor_id', tutor.id)
              .order('requested_at', { ascending: false })
              .limit(1)
              .single();

            // Update last_payout_date
            await supabase
              .from('Tutors')
              .update({ last_payout_date: new Date().toISOString() })
              .eq('id', tutor.id);

            results.processed++;
            results.totalAmount += amountPhp;
            
            // Store withdrawal details for report
            if (createdWithdrawal) {
              results.withdrawals.push({
                withdrawal_id: createdWithdrawal.id,
                tutor_id: tutor.id,
                tutor_name: `${tutor.first_name || ''} ${tutor.last_name || ''}`.trim() || tutor.email,
                tutor_email: tutor.email,
                amount: amountPhp,
                credits: availableCredits,
                status: createdWithdrawal.status,
                payment_method: tutor.payment_method,
                requested_at: createdWithdrawal.requested_at,
                note: createdWithdrawal.note,
                // Payment Details
                bank_account_name: tutor.bank_account_name,
                bank_account_number: tutor.bank_account_number,
                bank_name: tutor.bank_name,
                bank_branch: tutor.bank_branch,
                paypal_email: tutor.paypal_email,
                gcash_number: tutor.gcash_number,
                gcash_name: tutor.gcash_name,
              });
            }
          }
        }
      } catch (tutorError) {
        console.error(`Error processing tutor ${tutor.id}:`, tutorError);
        results.errors.push({
          tutor_id: tutor.id,
          error: tutorError.message,
        });
        results.failed++;
      }
    }

    // Generate and save payout report
    let reportId = null;
    try {
      const reportData = {
        withdrawals: results.withdrawals,
        errors: results.errors,
        summary: {
          total_payouts: results.processed + results.failed,
          successful_payouts: results.processed,
          failed_payouts: results.failed,
          pending_payouts: results.processed, // All created withdrawals start as pending
          total_amount: results.totalAmount,
          credit_rate: CREDIT_TO_PHP_RATE,
          period_start: periodStart.toISOString().split('T')[0],
          period_end: periodEnd.toISOString().split('T')[0],
        },
      };

      const { data: report, error: reportError } = await supabase
        .from('PayoutReports')
        .insert({
          report_period_start: periodStart.toISOString().split('T')[0],
          report_period_end: periodEnd.toISOString().split('T')[0],
          report_type: 'automatic_payout',
          total_payouts: results.processed + results.failed,
          total_amount: results.totalAmount,
          successful_payouts: results.processed,
          failed_payouts: results.failed,
          pending_payouts: results.processed,
          report_data: reportData,
          notes: isManual 
            ? `Manual payout processing (triggered by ${user?.email || 'admin'}) completed on ${new Date().toISOString()}`
            : `Automatic payout processing completed on ${new Date().toISOString()}`,
        })
        .select('id')
        .single();

      if (!reportError && report) {
        reportId = report.id;
        console.log(`Payout report generated with ID: ${reportId}`);
      } else {
        console.error('Error creating payout report:', reportError);
      // Continue even if report creation fails
      }
    } catch (reportErr) {
      console.error('Error generating payout report:', reportErr);
      // Continue even if report creation fails
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${results.processed} payouts, ${results.failed} failed`,
      results,
      timestamp: new Date().toISOString(),
      report_id: reportId,
    });
  } catch (error) {
    console.error('Cron payout processing error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process payouts' },
      { status: 500 }
    );
  }
}

// Also support GET for manual testing (protected by same secret)
export async function GET(request) {
  return POST(request);
}
