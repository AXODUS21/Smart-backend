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

async function checkWithdrawals() {
    const { data: reports, error } = await supabase
        .from('PayoutReports')
        .select('id, report_data')
        .order('id', { ascending: true });
    
    if (error) {
        console.error('Error fetching reports:', error);
        return;
    }
    
    for (const report of reports) {
        const withdrawals = report.report_data?.withdrawals || [];
        console.log(`\nReport #${report.id}:`);
        for (const w of withdrawals) {
            const wId = w.withdrawal_id;
            const { data: existingW, error: wError } = await supabase
                .from('TutorWithdrawals')
                .select('id, status')
                .eq('id', wId)
                .single();
            
            if (existingW) {
                console.log(`  Withdrawal ${wId}: EXISTS (Status: ${existingW.status})`);
            } else {
                console.log(`  Withdrawal ${wId}: MISSING`);
            }
        }
    }
}

checkWithdrawals();
