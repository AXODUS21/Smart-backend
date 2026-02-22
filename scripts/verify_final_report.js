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

async function verify() {
    const { data: report } = await supabase.from('PayoutReports').select('*').eq('id', 3).single();
    const l2 = report.report_data.withdrawals.find(w => w.tutor_email === 'lodorian2@gmail.com');
    if (l2) {
        console.log('lodorian2 found in report:');
        console.log(l2);
    } else {
        console.log('lodorian2 NOT found in report');
    }
    
    // Check total PHP/USD in summary
    console.log('Summary Totals:', report.report_data.summary);
}

verify();
