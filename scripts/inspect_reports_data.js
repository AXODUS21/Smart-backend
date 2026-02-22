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

async function inspectReports() {
    const { data: reports, error } = await supabase
        .from('PayoutReports')
        .select('id, report_data')
        .order('id', { ascending: true });
    
    if (error) {
        console.error('Error fetching reports:', error);
        return;
    }
    
    for (const report of reports) {
        const numWithdrawals = report.report_data?.withdrawals?.length || 0;
        const totalAmount = report.report_data?.summary?.total_amount || 0;
        console.log(`Report #${report.id}: ${numWithdrawals} withdrawals, Total: ${totalAmount}`);
        if (numWithdrawals > 0) {
            console.log('Sample withdrawal tutor:', report.report_data.withdrawals[0].tutor_email);
        }
    }
}

inspectReports();
