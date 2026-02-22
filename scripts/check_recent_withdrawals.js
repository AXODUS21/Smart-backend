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
    console.log('Checking recent withdrawals...');
    const { data: withdrawals, error } = await supabase
        .from('TutorWithdrawals')
        .select('*')
        .order('requested_at', { ascending: false })
        .limit(20);

    if (error) {
        console.error(error);
        return;
    }

    console.table(withdrawals);
}

checkWithdrawals();
