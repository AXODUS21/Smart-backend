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

async function checkLodorian2() {
    const { data: tutor } = await supabase.from('Tutors').select('id').eq('email', 'lodorian2@gmail.com').single();
    if (!tutor) return;
    const { data: withdrawals } = await supabase.from('TutorWithdrawals').select('*').eq('tutor_id', tutor.id);
    console.log('Withdrawals for lodorian2:');
    withdrawals.forEach(w => {
       console.log(`- ID: ${w.id} | Amount: ${w.amount} | Status: ${w.status} | Note: ${w.note}`);
    });
}

checkLodorian2();
