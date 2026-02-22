const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
    }
  });
} catch (e) {}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function verifyUsdRate() {
    console.log('Verifying USD Rate in Report #3...');
    const { data: report, error } = await supabase
        .from('PayoutReports')
        .select('*')
        .eq('id', 3)
        .single();

    if (error) {
        console.error('Error fetching report:', error);
        return;
    }

    if (report.report_data && report.report_data.summary) {
        console.log('Credit Rate (PHP):', report.report_data.summary.credit_rate);
        console.log('Credit Rate (USD):', report.report_data.summary.credit_rate_usd);
        
        if (report.report_data.summary.credit_rate_usd === 1.5) {
            console.log('SUCCESS: USD Credit Rate is correct.');
        } else {
            console.log('FAILURE: USD Credit Rate is incorrect or missing.');
        }
    } else {
        console.log('WARNING: Summary missing from report data.');
    }
}

verifyUsdRate();
