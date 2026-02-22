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

async function findSuccessfulPHP() {
    console.log('Searching for completed Stripe PHP transfers...');
    const { data: withdrawals, error } = await supabase
        .from('TutorWithdrawals')
        .select('*')
        .eq('status', 'completed')
        .eq('payment_method', 'stripe')
        .ilike('note', '%PHP%'); // Looking for PHP in the note

    if (error) {
        console.error(error);
        return;
    }

    if (withdrawals.length === 0) {
        console.log('No successful PHP Stripe transfers found in history.');
    } else {
        console.table(withdrawals);
    }
}

findSuccessfulPHP();
