const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
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
const CREDIT_TO_USD_RATE = 1.5;
const PHP_TO_USD_RATE = 56; // 1 USD = 56 PHP (Approximation for settlement)

async function generateReport() {
    console.log('Starting Payout Report Cleanup and Generation...');

    // 1. DELETE reports except 1 and 2
    console.log('Deleting PayoutReports except IDs 1 and 2...');
    const { error: deleteError } = await supabase
        .from('PayoutReports')
        .delete()
        .not('id', 'in', '(1,2)'); // Delete where id is NOT in (1, 2)
    
    if (deleteError) {
        console.error('Error deleting old reports:', deleteError);
        return;
    }

    // 1.5 DELETE recent test withdrawals to reset available credits
    console.log('Deleting recent test withdrawals to reset credits...');
    const { error: withdrawalDeleteError } = await supabase
        .from('TutorWithdrawals')
        .delete()
        .or('note.ilike.%Manual ID 3%,note.ilike.%Cleanup Run%,note.ilike.%Automatic payout%');
        
    if (withdrawalDeleteError) {
        console.error('Error deleting test withdrawals:', withdrawalDeleteError);
    } else {
        console.log('Test withdrawals deleted.');
    }
    
    console.log('Cleanup complete.');

    // 2. Generate New Report matching 'app/api/cron/process-payouts/route.js' logic
    console.log('Starting Manual Payout Generation (System Logic Aligned)...');
    
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
      totalAmountPHP: 0,
      totalAmountUSD: 0,
      errors: [],
      withdrawals: [],
    };

    // Get all tutors with pricing_region
    const { data: tutors, error: tutorsError } = await supabase
      .from('Tutors')
      .select('id, user_id, first_name, last_name, email, payment_method, last_payout_date, bank_account_name, bank_account_number, bank_name, bank_branch, paypal_email, gcash_number, gcash_name, stripe_account_id, stripe_onboarding_complete, pricing_region');

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

        // Determine rate based on region
        const exchangeRate = (tutor.pricing_region === 'PH') ? CREDIT_TO_PHP_RATE : CREDIT_TO_USD_RATE;
        const currency = (tutor.pricing_region === 'PH') ? 'PHP' : 'USD';

        const totalWithdrawnCredits = withdrawals
          ? withdrawals.reduce((total, w) => total + parseFloat(w.amount || 0) / exchangeRate, 0)
          : 0;

        const availableCredits = totalCreditsEarned - totalWithdrawnCredits;

        // Only process if tutor has earned credits
        if (availableCredits > 0) {
          console.log(`Processing Tutor: ${tutor.email} - Region: ${tutor.pricing_region || 'PH'} - Credits: ${availableCredits}`);
          const amount = availableCredits * exchangeRate;

          // Payment Validation Logic (Aligned with automatic)
           let hasValidPayment = false;
           if (tutor.payment_method === 'bank') {
              hasValidPayment = !!(tutor.bank_account_number && tutor.bank_name);
           } else if (tutor.payment_method === 'paypal') {
              const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
              hasValidPayment = !!(tutor.paypal_email && emailRegex.test(tutor.paypal_email));
           } else if (tutor.payment_method === 'gcash') {
              const gcashRegex = /^09\d{9}$/;
              hasValidPayment = !!(tutor.gcash_number && gcashRegex.test(tutor.gcash_number.replace(/-/g, '').replace(/\s/g, '')));
           } else if (tutor.payment_method === 'stripe') {
               // Checking stripe explicitly too
               hasValidPayment = !!(tutor.stripe_account_id && tutor.stripe_onboarding_complete);
           }

           // Fallback: If invalid payment info but Stripe is connected, use Stripe
           // This handles cases where user selected 'bank' but didn't fill it out, but DID connect Stripe.
           if (!hasValidPayment && tutor.stripe_account_id && tutor.stripe_onboarding_complete) {
               console.log(`Switching ${tutor.email} to Stripe (Fallback) - ${tutor.payment_method} was invalid/missing details.`);
               tutor.payment_method = 'stripe';
               hasValidPayment = true;
           }

           if (!hasValidPayment) {
             console.log(`Skipping ${tutor.email} due to invalid payment info (${tutor.payment_method}).`);
             continue;
           }

          // Stripe Logic
          let stripeTransferId = null;
          let withdrawalStatus = 'pending';
          let withdrawalNote = `Automatic payout (Manual Run): ${availableCredits} credits = ${currency} ${amount.toFixed(2)}`;

          if (stripe && tutor.stripe_account_id && tutor.stripe_onboarding_complete) {
              try {
                  let transferAmount = Math.round(amount * 100); // Default cents
                  let settlementCurrency = currency.toLowerCase();

                  // FALLBACK: If currency is PHP, convert to USD for settlement since platform balance is USD
                  if (currency === 'PHP') {
                      const amountUsd = amount / PHP_TO_USD_RATE;
                      transferAmount = Math.round(amountUsd * 100);
                      settlementCurrency = 'usd';
                      withdrawalNote += ` (Settled in USD: $${amountUsd.toFixed(2)})`;
                      console.log(`Converting ${amount} PHP to approximately ${amountUsd.toFixed(2)} USD for Stripe settlement.`);
                  }

                  const transfer = await stripe.transfers.create({
                      amount: transferAmount,
                      currency: settlementCurrency,
                      destination: tutor.stripe_account_id,
                      description: `Payout for ${availableCredits} credits (${amount} ${currency})`,
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
              amount: amount,
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
          if (currency === 'PHP') results.totalAmountPHP += amount;
          else results.totalAmountUSD += amount;
          
          results.withdrawals.push({
              withdrawal_id: withdrawalData.id,
              tutor_id: tutor.id,
              tutor_name: `${tutor.first_name || ''} ${tutor.last_name || ''}`.trim() || tutor.email,
              tutor_email: tutor.email,
              amount: amount,
              currency: currency,
              pricing_region: tutor.pricing_region || (currency === 'PHP' ? 'PH' : 'US'), // ENSURE REGION IS HERE
              credits: availableCredits,
              status: withdrawalData.status,
              payment_method: tutor.payment_method,
              requested_at: withdrawalData.requested_at,
              note: withdrawalData.note
          });
          console.log(`Created withdrawal for ${tutor.email}: ${amount} ${currency}`);
        }
      } catch (tutorError) {
        console.error(`Error processing tutor ${tutor.id}:`, tutorError);
        results.failed++;
      }
    }

    // Generate Report with ID 3
    console.log('Generating Payout Report...');
    const reportData = {
        withdrawals: results.withdrawals,
        errors: results.errors,
        summary: {
          total_payouts: results.processed + results.failed,
          successful_payouts: results.processed,
          failed_payouts: results.failed,
          pending_payouts: results.processed,
          total_amount_php: results.totalAmountPHP,
          total_amount_usd: results.totalAmountUSD,
          // Legacy total_amount field (usually PHP in old system, but debatable now)
          total_amount: results.totalAmountPHP, 
          credit_rate_php: CREDIT_TO_PHP_RATE,
          credit_rate_usd: CREDIT_TO_USD_RATE,
          // Legacy credit_rate
          credit_rate: CREDIT_TO_PHP_RATE,
          period_start: periodStart.toISOString().split('T')[0],
          period_end: periodEnd.toISOString().split('T')[0],
        },
    };

    const { data: report, error: reportError } = await supabase
        .from('PayoutReports')
        .insert({
            id: 3, // FORCE ID 3
            report_period_start: periodStart.toISOString().split('T')[0],
            report_period_end: periodEnd.toISOString().split('T')[0],
            report_type: 'automatic_payout',
            total_payouts: results.processed + results.failed,
            total_amount: results.totalAmountPHP,
            successful_payouts: results.processed,
            failed_payouts: results.failed,
            pending_payouts: results.processed,
            report_data: reportData,
            notes: `Manual cleanup and payout generation (ID 3) completed on ${new Date().toISOString()}`,
        })
        .select('id')
        .single();

    if (reportError) {
        console.error('Error creating report:', reportError);
    } else {
        console.log(`Payout Report Created Successfully! ID: ${report.id}`);
        console.log(`Summary: PHP ${results.totalAmountPHP}, USD ${results.totalAmountUSD}`);
    }
}

generateReport();
