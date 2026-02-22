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

async function verifySummary() {
    console.log('Verifying Report #3 Summary...');
    const { data: report, error } = await supabase
        .from('PayoutReports')
        .select('*')
        .eq('id', 3)
        .single();
    
    if (report && report.report_data && report.report_data.summary) {
        console.log('Summary:', report.report_data.summary);
    } else {
        console.log('Error or missing summary:', error);
    }
}

verifySummary();
