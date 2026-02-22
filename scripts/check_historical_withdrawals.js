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

async function findHistory() {
    console.log('Searching for ALL completed Stripe withdrawals...');
    const { data: withdrawals, error } = await supabase
        .from('TutorWithdrawals')
        .select('*')
        .eq('status', 'completed')
        .eq('payment_method', 'stripe');

    if (error) {
        console.error(error);
        return;
    }

    if (withdrawals.length === 0) {
        console.log('No completed Stripe withdrawals found.');
    } else {
        console.table(withdrawals.map(w => ({
            id: w.id,
            tutor_id: w.tutor_id,
            amount: w.amount,
            note: w.note
        })));
    }
}

findHistory();
