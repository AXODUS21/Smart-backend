import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const CREDIT_TO_PHP_RATE = 90;
const CREDIT_TO_USD_RATE = 1.5; // 1 credit = $1.50 USD for international tutors

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase configuration');
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

export async function GET(request) {
  try {
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    if (!start || !end) {
      return NextResponse.json(
        { error: 'Start and end dates are required' },
        { status: 400 }
      );
    }

    // Set times to cover full days
    const startDate = new Date(start);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);

    // Fetch withdrawals within range, including Tutor details
    const { data: withdrawalsData, error } = await supabase
      .from('TutorWithdrawals')
      .select('*, Tutors(first_name, last_name, email, pricing_region, payment_method, bank_account_name, bank_account_number, bank_name, bank_branch, paypal_email, gcash_number, gcash_name, stripe_account_id, credits)')
      .gte('requested_at', startDate.toISOString())
      .lte('requested_at', endDate.toISOString())
      .order('requested_at', { ascending: false });

    if (error) {
      throw error;
    }

    // Process and flatten data
    const withdrawals = withdrawalsData.map(w => {
      const tutor = w.Tutors || {};
      const tutorName = tutor.first_name && tutor.last_name 
        ? `${tutor.first_name} ${tutor.last_name}`.trim()
        : (tutor.email || 'Unknown');

      const isInternational = tutor.pricing_region !== 'PH';
      const credits = isInternational
        ? Math.round((w.amount || 0) / CREDIT_TO_USD_RATE)
        : Math.round((w.amount || 0) / CREDIT_TO_PHP_RATE);

      return {
        withdrawal_id: w.id,
        tutor_id: w.tutor_id,
        tutor_name: tutorName,
        tutor_email: tutor.email,
        pricing_region: tutor.pricing_region || 'US',
        is_international: isInternational,
        amount: w.amount,
        amount_usd: isInternational ? parseFloat(w.amount || 0) : null,
        credits,
        status: w.status,
        payment_method: w.payment_method || tutor.payment_method || 'manual', // Fallback to tutor profile if not in record
        requested_at: w.requested_at,
        note: w.note,
        
        // Payment Details fallback to Tutor current details if not snapshot (which it isn't usually)
        bank_account_name: tutor.bank_account_name,
        bank_account_number: tutor.bank_account_number,
        bank_name: tutor.bank_name,
        bank_branch: tutor.bank_branch,
        paypal_email: tutor.paypal_email,
        gcash_number: tutor.gcash_number,
        gcash_name: tutor.gcash_name,
        current_tutor_credits: tutor.credits || 0,
      };
    });

    // Calculate Summary
    const summary = {
      total_payouts: withdrawals.length,
      successful_payouts: withdrawals.filter(w => w.status === 'completed').length,
      failed_payouts: withdrawals.filter(w => ['failed', 'rejected'].includes(w.status)).length,
      pending_payouts: withdrawals.filter(w => ['pending', 'approved', 'processing'].includes(w.status)).length,
      total_amount: withdrawals
        .filter(w => !w.is_international)
        .reduce((sum, w) => sum + (parseFloat(w.amount) || 0), 0),
      total_amount_php: withdrawals
        .filter(w => !w.is_international)
        .reduce((sum, w) => sum + (parseFloat(w.amount) || 0), 0),
      total_amount_usd: withdrawals
        .filter(w => w.is_international)
        .reduce((sum, w) => sum + (parseFloat(w.amount) || 0), 0),
      credit_rate: CREDIT_TO_PHP_RATE,
      credit_rate_usd: CREDIT_TO_USD_RATE,
      period_start: start,
      period_end: end
    };

    return NextResponse.json({
      withdrawals,
      summary,
      errors: [] // No processing errors since we are just reading
    });

  } catch (error) {
    console.error('Error generating payout stats:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate payout stats' },
      { status: 500 }
    );
  }
}
