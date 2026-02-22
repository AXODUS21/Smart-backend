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

async function inspectSchema() {
    console.log('Inspecting TutorWithdrawals columns...');
    const { data: withdrawals } = await supabase.from('TutorWithdrawals').select('*').limit(1);
    console.log('Columns:', Object.keys(withdrawals[0] || {}));
    
    console.log('\nInspecting Report 3 Data...');
    const { data: report } = await supabase.from('PayoutReports').select('*', { count: 'exact' }).eq('id', 3).single();
    if (report) {
        console.log('Report 3 Withdrawals:');
        report.report_data.withdrawals.forEach(w => {
            console.log(`- ${w.tutor_email}: ${w.amount} ${w.currency || '???'} | Credits: ${w.credits}`);
        });
    }
}

inspectSchema();
