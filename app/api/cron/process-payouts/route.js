import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const CREDIT_TO_PHP_RATE = 180; // 1 credit = 180 PHP

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
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid cron secret' },
        { status: 401 }
      );
    }

    const supabase = getSupabaseClient();
    const results = {
      processed: 0,
      failed: 0,
      totalAmount: 0,
      errors: [],
    };

    // Get all tutors with their sessions
    const { data: tutors, error: tutorsError } = await supabase
      .from('Tutors')
      .select('id, user_id, first_name, last_name, email, payment_method, last_payout_date');

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
          .in('status', ['approved', 'processing', 'completed']);

        const totalWithdrawnCredits = withdrawals
          ? withdrawals.reduce((total, w) => total + parseFloat(w.amount || 0) / CREDIT_TO_PHP_RATE, 0)
          : 0;

        const availableCredits = totalCreditsEarned - totalWithdrawnCredits;

        // Only process if tutor has earned credits
        if (availableCredits > 0) {
          const amountPhp = availableCredits * CREDIT_TO_PHP_RATE;

          // Validate payment information
          const hasValidPayment = 
            (tutor.payment_method === 'bank' && tutor.bank_account_number) ||
            (tutor.payment_method === 'paypal' && tutor.paypal_email) ||
            (tutor.payment_method === 'gcash' && tutor.gcash_number);

          if (!hasValidPayment) {
            console.warn(`Tutor ${tutor.id} has no payment info - skipping payout`);
            continue;
          }

          // Create withdrawal record (status: pending for superadmin approval)
          const { error: withdrawalError } = await supabase
            .from('TutorWithdrawals')
            .insert({
              tutor_id: tutor.id,
              amount: amountPhp,
              status: 'pending',
              note: `Automatic payout (${new Date().toISOString().split('T')[0]}): ${availableCredits} credits = ₱${amountPhp.toFixed(2)}`,
            });

          if (withdrawalError) {
            results.errors.push({
              tutor_id: tutor.id,
              error: withdrawalError.message,
            });
            results.failed++;
          } else {
            // Update last_payout_date
            await supabase
              .from('Tutors')
              .update({ last_payout_date: new Date().toISOString() })
              .eq('id', tutor.id);

            results.processed++;
            results.totalAmount += amountPhp;
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

    return NextResponse.json({
      success: true,
      message: `Processed ${results.processed} payouts, ${results.failed} failed`,
      results,
      timestamp: new Date().toISOString(),
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
