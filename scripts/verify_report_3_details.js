const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

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

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function verifyReport3() {
    console.log('Fetching Payout Report #3...');
    const { data: report, error } = await supabase
        .from('PayoutReports')
        .select('*')
        .eq('id', 3)
        .single();

    if (error) {
        console.error('Error fetching report:', error);
        return;
    }

    console.log('Report Details:');
    console.log('Total Amount:', report.total_amount);
    console.log('Successful Payouts:', report.successful_payouts);
    console.log('Failed Payouts:', report.failed_payouts);
    
    // Check strict equality and existence of summary
    if (report.report_data && report.report_data.summary) {
        console.log('Credit Rate in Summary:', report.report_data.summary.credit_rate);
    } else {
        console.log('WARNING: report_data.summary is missing!');
    }

    if (report.report_data && report.report_data.withdrawals) {
        const stripeWithdrawals = report.report_data.withdrawals.filter(w => w.note && w.note.includes('Stripe'));
        console.log(`Found ${stripeWithdrawals.length} Stripe withdrawals in report data.`);
        if (stripeWithdrawals.length > 0) {
            console.log('Sample Stripe Withdrawal:', stripeWithdrawals[0]);
        }
    }
}

verifyReport3();
