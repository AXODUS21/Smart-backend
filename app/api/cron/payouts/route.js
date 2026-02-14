
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Vercel Cron jobs are triggered by a GET request
export async function GET(request) {
  // Security check: Verify Vercel Cron signature
  // In production, you should verify the `Authorization` header
  // format: `Bearer ${process.env.CRON_SECRET}`
  const authHeader = request.headers.get('authorization');
  if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Double check date logic (15th or Last Day)
  const today = new Date();
  const day = today.getDate();
  const is15th = day === 15;
  
  // efficient last day check: tomorrow is 1st
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isLastDay = tomorrow.getDate() === 1;

  // Allow manual override for testing via query param ?force=true
  const { searchParams } = new URL(request.url);
  const force = searchParams.get('force') === 'true';

  if (!is15th && !isLastDay && !force) {
    return NextResponse.json({ message: 'Not payout day' }, { status: 200 });
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    // Initialize Stripe
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    // 1. Get all tutors with positive credits and connected Stripe accounts
    // Note: We need a way to efficiently query total credits. 
    // The current system calculates credits on the fly from sessions.
    
    // For efficiency in a cron job, we might want to:
    // A. Iterate all tutors (might be slow if thousands)
    // B. Or better: Fetch all "completed" sessions that haven't been "paid out" yet?
    // The current system has `TutorWithdrawals` but no direct link from Session -> Withdrawal.
    // It calculates: Total Earned - Total Withdrawn.
    
    // Fetch all tutors 
    const { data: tutors, error: tutorsError } = await supabase
      .from('Tutors')
      .select('id, user_id, email, first_name, last_name, stripe_account_id, payment_method, bank_name, bank_account_name, bank_account_number, bank_branch, paypal_email, gcash_name, gcash_number');

    if (tutorsError) throw tutorsError;

    const results = [];
    const errors = [];

    for (const tutor of tutors) {
       // Skip if no Stripe Connect
       if (!tutor.stripe_account_id) {
           continue; 
       }

       // Calculate credits
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

       // Fetch withdrawals
       const { data: withdrawals } = await supabase
          .from('TutorWithdrawals')
          .select('amount')
          .eq('tutor_id', tutor.id)
          .in('status', ['approved', 'processing', 'completed']);

       const totalWithdrawnCredits = withdrawals
          ? withdrawals.reduce((total, w) => total + parseFloat(w.amount || 0) / 90, 0)
          : 0;

       const availableCredits = Math.max(0, totalCreditsEarned - totalWithdrawnCredits);

       // Minimum threshold for payout
       if (availableCredits < 1) continue;

       const amountPhp = availableCredits * 90;
       
       const tutorName = `${tutor.first_name || ''} ${tutor.last_name || ''}`.trim() || tutor.email;

        // Process Payout
        if (searchParams.get('dryRun') === 'true') {
             results.push({ 
                 tutor_id: tutor.id,
                 tutor_name: tutorName,
                 tutor_email: tutor.email,
                 credits: availableCredits,
                 amount: amountPhp, 
                 status: 'dry-run',
                 payment_method: 'stripe',
                 stripe_account_id: tutor.stripe_account_id,
                 bank_name: tutor.bank_name,
                 bank_account_name: tutor.bank_account_name,
                 bank_account_number: tutor.bank_account_number,
                 bank_branch: tutor.bank_branch,
                 paypal_email: tutor.paypal_email,
                 gcash_name: tutor.gcash_name,
                 gcash_number: tutor.gcash_number,
                 note: 'Would transfer'
             });
             continue;
        }

        try {
            // 1. Record Withdrawal ("processing")
           const { data: withdrawal, error: insertError } = await supabase
               .from('TutorWithdrawals')
               .insert({
                   tutor_id: tutor.id,
                   amount: amountPhp,
                   status: 'processing',
                   note: 'Automatic scheduled payout',
                   payout_provider: 'stripe',
               })
               .select()
               .single();
            
            if (insertError) throw insertError;

            // 2. Stripe Transfer
            const usdToPhpRate = parseFloat(process.env.USD_TO_PHP_RATE || '56');
            const amountUsd = amountPhp / usdToPhpRate;
            const amountInCents = Math.round(amountUsd * 100);

            const transfer = await stripe.transfers.create({
                amount: amountInCents,
                currency: 'usd', 
                destination: tutor.stripe_account_id,
                description: `Automatic Payout #${withdrawal.id}`,
            });

            // 3. Mark Completed
            await supabase
                .from('TutorWithdrawals')
                .update({ 
                    status: 'completed',
                    payout_transaction_id: transfer.id,
                    processed_at: new Date().toISOString()
                })
                .eq('id', withdrawal.id);

            results.push({ 
                withdrawal_id: withdrawal.id,
                tutor_id: tutor.id,
                tutor_name: tutorName,
                tutor_email: tutor.email,
                credits: availableCredits,
                amount: amountPhp, 
                status: 'completed',
                payment_method: 'stripe',
                stripe_account_id: tutor.stripe_account_id,
                bank_name: tutor.bank_name,
                bank_account_name: tutor.bank_account_name,
                bank_account_number: tutor.bank_account_number,
                bank_branch: tutor.bank_branch,
                paypal_email: tutor.paypal_email,
                gcash_name: tutor.gcash_name,
                gcash_number: tutor.gcash_number,
                requested_at: new Date().toISOString()
            });

       } catch (err) {
           console.error(`Payout failed for tutor ${tutor.email}:`, err);
           errors.push({ 
               tutor_id: tutor.id, 
               tutor_name: tutorName,
               error: err.message 
           });
       }
    }

    // --- Generate Payout Report ---
    let reportId = null;
    if (results.length > 0 || errors.length > 0) {
        try {
             // Determine dates for report metadata
             const now = new Date();
             const periodStart = new Date(now);
             const periodEnd = new Date(now);
             
             if (now.getDate() <= 15) {
                 periodStart.setDate(1);
                 periodEnd.setDate(15);
             } else {
                 periodStart.setDate(16);
                 periodEnd.setDate(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate());
             }

             const totalAmount = results.reduce((sum, r) => sum + (r.amount || 0), 0);
             const successCount = results.filter(r => r.status === 'completed' || r.status === 'dry-run').length;
             const failedCount = errors.length;

             const reportData = {
                 withdrawals: results,
                 errors: errors,
                 summary: {
                     total_payouts: successCount + failedCount,
                     successful_payouts: successCount,
                     failed_payouts: failedCount,
                     total_amount: totalAmount,
                     period_start: periodStart.toISOString().split('T')[0],
                     period_end: periodEnd.toISOString().split('T')[0],
                     credit_rate: 90
                 }
             };

             const { data: report, error: reportError } = await supabase
                .from('PayoutReports')
                .insert({
                    report_period_start: periodStart.toISOString().split('T')[0],
                    report_period_end: periodEnd.toISOString().split('T')[0],
                    report_type: 'automatic_payout',
                    total_payouts: successCount + failedCount,
                    total_amount: totalAmount,
                    successful_payouts: successCount,
                    failed_payouts: failedCount,
                    pending_payouts: 0,
                    report_data: reportData,
                    notes: `Automatic payout processing (Force=${force}, DryRun=${searchParams.get('dryRun')})`
                })
                .select('id')
                .single();
            
             if (report) reportId = report.id;
             if (reportError) console.error('Failed to create PayoutReport:', reportError);

        } catch (reportErr) {
            console.error('Error generating report:', reportErr);
        }
    }

    return NextResponse.json({ 
        success: true, 
        processed: results.length, 
        errors: errors.length,
        report_id: reportId,
        results,
        errors
    });

  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
