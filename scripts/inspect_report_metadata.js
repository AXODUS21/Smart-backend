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

async function inspectReportMetadata() {
    const { data: reports, error } = await supabase
        .from('PayoutReports')
        .select('id, report_data')
        .in('id', [1, 2]);
    
    if (error) {
        console.error('Error fetching reports:', error);
        return;
    }
    
    for (const report of reports) {
        console.log(`\nReport #${report.id} Metadata:`);
        const withdrawals = report.report_data?.withdrawals || [];
        for (const w of withdrawals) {
            console.log(`  - Withdrawal ID in JSON: ${w.withdrawal_id}, Amount: ${w.amount}, Tutor: ${w.tutor_email}`);
        }
    }
}

inspectReportMetadata();
