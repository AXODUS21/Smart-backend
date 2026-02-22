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

async function debugTutor() {
    const email = 'lodorian2@gmail.com';
    console.log(`Debugging ${email}...`);
    
    const { data: tutor } = await supabase.from('Tutors').select('*').eq('email', email).single();
    if (!tutor) { console.log('Tutor not found'); return; }

    const { data: sessions } = await supabase.from('Schedules').select('credits_required, status, session_status, session_action').eq('tutor_id', tutor.id);
    const earned = sessions.filter(s => s.status === 'confirmed' && (s.session_status === 'successful' || s.session_action === 'review-submitted')).reduce((sum, s) => sum + parseFloat(s.credits_required || 0), 0);
    
    const { data: withdrawals } = await supabase.from('TutorWithdrawals').select('amount, status').eq('tutor_id', tutor.id).in('status', ['pending', 'approved', 'processing', 'completed']);
    
    const CREDIT_TO_PHP_RATE = 90;
    const CREDIT_TO_USD_RATE = 1.5;
    const rate = (tutor.pricing_region === 'PH') ? CREDIT_TO_PHP_RATE : CREDIT_TO_USD_RATE;
    
    const withdrawnCredits = withdrawals ? withdrawals.reduce((sum, w) => sum + (parseFloat(w.amount || 0) / rate), 0) : 0;
    
    console.log(`Region: ${tutor.pricing_region}`);
    console.log(`Total Earned: ${earned}`);
    console.log(`Total Withdrawn (Calculated Credits): ${withdrawnCredits}`);
    console.log(`Available: ${earned - withdrawnCredits}`);
}

debugTutor();
