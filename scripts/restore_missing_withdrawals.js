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

async function restoreWithdrawals() {
    console.log('Fetching Reports #1 and #2 to extract metadata...');
    const { data: reports, error } = await supabase
        .from('PayoutReports')
        .select('id, report_data')
        .in('id', [1, 2])
        .order('id', { ascending: true });
    
    if (error) {
        console.error('Error fetching reports:', error);
        return;
    }

    for (const report of reports) {
        console.log(`\nProcessing Report #${report.id}...`);
        const withdrawals = report.report_data?.withdrawals || [];
        
        for (const w of withdrawals) {
            console.log(`  Restoring withdrawal for ${w.tutor_email} (Amount: ${w.amount})...`);
            
            // Re-insert into TutorWithdrawals
            // We won't force the ID (standard auto-increment might fail if we try to force 1 or 2)
            // But we will insert the record so calculations work.
            const { data: inserted, error: iError } = await supabase
                .from('TutorWithdrawals')
                .insert({
                    tutor_id: w.tutor_id,
                    amount: w.amount,
                    status: w.status || 'completed',
                    payment_method: w.payment_method,
                    note: w.note + ' (Restored from Report Metadata)',
                    requested_at: w.requested_at
                })
                .select('id')
                .single();
            
            if (iError) {
                console.error(`  Failed to restore withdrawal:`, iError.message);
            } else {
                console.log(`  Successfully restored! New Withdrawal ID: ${inserted.id}`);
                
                // OPTIONAL: Update the PayoutReport JSON to point to the new ID so it stays consistent
                // Actually, let's do it to be thorough.
                w.withdrawal_id = inserted.id;
            }
        }
        
        // Save the updated report_data with new foreign keys
        const { error: uError } = await supabase
            .from('PayoutReports')
            .update({ report_data: report.report_data })
            .eq('id', report.id);
            
        if (uError) {
            console.error(`  Failed to update report #${report.id} JSON:`, uError.message);
        } else {
            console.log(`  Updated Report #${report.id} metadata with new withdrawal IDs.`);
        }
    }
    
    console.log('\nRestoration complete.');
}

restoreWithdrawals();
