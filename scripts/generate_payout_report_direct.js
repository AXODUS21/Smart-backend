const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
// Note: We don't need 'stripe' for this specific request if we want to avoid installing it, 
// but the original code uses it. If the tutor doesn't have stripe connected or we don't need real transfers, we can mock it or just omit.
// However, to be safe and complete, let's try to require it. If it fails, we'll skip stripe logic.
let Stripe;
try {
    Stripe = require('stripe');
} catch (e) {
    console.log('Stripe module not found, skipping real stripe transfers.');
}

// Simple .env parser
try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      process.env[key] = value;
    }
  });
} catch (e) {
  console.log('Could not load .env.local', e.message);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

const stripe = (Stripe && stripeSecretKey) ? new Stripe(stripeSecretKey) : null;
const CREDIT_TO_PHP_RATE = 90;

async function generateReport() {
    console.log('Starting Manual Payout Report Generation...');
    
    const dryRun = false; // We want to actually generate it
    const force = true;   // We are forcing it
    
    // Determine payout period dates - covering everything up to now effectively for this report
    // Or just use the standard logic? Let's use standard logic but forced.
    const now = new Date();
    const currentDay = now.getDate();
    let periodStart = new Date(now);
    let periodEnd = new Date(now);

    if (currentDay <= 15) {
        periodStart.setDate(1);
        periodEnd.setDate(15);
    } else {
        periodStart.setDate(16);
        periodEnd.setDate(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate());
    }
    
    console.log(`Period: ${periodStart.toISOString().split('T')[0]} to ${periodEnd.toISOString().split('T')[0]}`);

    const results = {
      processed: 0,
      failed: 0,
      totalAmount: 0,
      errors: [],
      withdrawals: [],
    };

    // Get all tutors
    const { data: tutors, error: tutorsError } = await supabase
      .from('Tutors')
      .select('id, user_id, first_name, last_name, email, payment_method, last_payout_date, bank_account_name, bank_account_number, bank_name, bank_branch, paypal_email, gcash_number, gcash_name, stripe_account_id, stripe_onboarding_complete');

    if (tutorsError) {
        console.error('Error fetching tutors:', tutorsError);
        return;
    }
    console.log(`Found ${tutors.length} tutors.`);

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
          console.log(`Processing Tutor: ${tutor.email} - Available Credits: ${availableCredits}`);
          const amountPhp = availableCredits * CREDIT_TO_PHP_RATE;

          // Payment Validation Logic (simplified from route.js)
           let hasValidPayment = false;
           if (tutor.payment_method === 'bank') {
              hasValidPayment = !!(tutor.bank_account_number && tutor.bank_name);
           } else if (tutor.payment_method === 'paypal') {
              const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
              hasValidPayment = !!(tutor.paypal_email && emailRegex.test(tutor.paypal_email));
           } else if (tutor.payment_method === 'gcash') {
              const gcashRegex = /^09\d{9}$/;
              hasValidPayment = !!(tutor.gcash_number && gcashRegex.test(tutor.gcash_number.replace(/-/g, '').replace(/\s/g, '')));
           }

           if (!hasValidPayment) {
             console.log(`Skipping ${tutor.email} due to invalid payment info (${tutor.payment_method}).`);
             continue;
           }

          // Stripe Logic
          let stripeTransferId = null;
          let withdrawalStatus = 'pending';
          let withdrawalNote = `Automatic payout (Manual Run): ${availableCredits} credits = ₱${amountPhp.toFixed(2)}`;

          if (stripe && tutor.stripe_account_id && tutor.stripe_onboarding_complete) {
              try {
                  const transfer = await stripe.transfers.create({
                      amount: Math.round(amountPhp * 100),
                      currency: 'php',
                      destination: tutor.stripe_account_id,
                      description: `Payout for ${availableCredits} credits`,
                  });
                  stripeTransferId = transfer.id;
                  withdrawalStatus = 'completed';
                  withdrawalNote += ` (Stripe Transfer: ${stripeTransferId})`;
                  console.log(`Stripe transfer successful: ${stripeTransferId}`);
              } catch (stripeError) {
                  console.error(`Stripe transfer failed:`, stripeError.message);
                  withdrawalNote += ` (Stripe Failed: ${stripeError.message})`;
                  results.errors.push({
                      tutor_id: tutor.id,
                      tutor_name: tutor.email,
                      error: `Stripe Transfer Failed: ${stripeError.message}`
                  });
              }
          }

          // Create Withdrawal Record
          const { data: withdrawalData, error: withdrawalError } = await supabase
            .from('TutorWithdrawals')
            .insert({
              tutor_id: tutor.id,
              amount: amountPhp,
              status: withdrawalStatus,
              payment_method: tutor.payment_method,
              note: withdrawalNote,
            })
            .select('id, tutor_id, amount, status, requested_at, note')
            .single();

          if (withdrawalError) {
            console.error(`Failed to create withdrawal for ${tutor.email}:`, withdrawalError);
            results.errors.push({
              tutor_id: tutor.id,
              tutor_name: tutor.email,
              error: withdrawalError.message,
            });
            results.failed++;
            continue;
          }

          // Update last_payout_date
          await supabase
            .from('Tutors')
            .update({ last_payout_date: new Date().toISOString() })
            .eq('id', tutor.id);

          results.processed++;
          results.totalAmount += amountPhp;
          
          results.withdrawals.push({
              withdrawal_id: withdrawalData.id,
              tutor_id: tutor.id,
              tutor_name: `${tutor.first_name || ''} ${tutor.last_name || ''}`.trim() || tutor.email,
              tutor_email: tutor.email,
              amount: amountPhp,
              credits: availableCredits,
              status: withdrawalData.status,
              payment_method: tutor.payment_method,
              requested_at: withdrawalData.requested_at,
              note: withdrawalData.note
          });
          console.log(`Created withdrawal for ${tutor.email}: ${amountPhp} PHP`);
        }
      } catch (tutorError) {
        console.error(`Error processing tutor ${tutor.id}:`, tutorError);
        results.failed++;
      }
    }

    // Generate Report
    console.log('Generating Payout Report...');
    const reportData = {
        withdrawals: results.withdrawals,
        errors: results.errors,
        summary: {
          total_payouts: results.processed + results.failed,
          successful_payouts: results.processed,
          failed_payouts: results.failed,
          pending_payouts: results.processed,
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
            notes: `Manual script payout processing completed on ${new Date().toISOString()}`,
        })
        .select('id')
        .single();

    if (reportError) {
        console.error('Error creating report:', reportError);
    } else {
        console.log(`Payout Report Created Successfully! ID: ${report.id}`);
    }
}

generateReport();
