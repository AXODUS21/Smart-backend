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

async function checkAll() {
    const { data: tutors } = await supabase.from('Tutors').select('id, email, pricing_region, payment_method');
    
    const CREDIT_TO_PHP_RATE = 90;
    const CREDIT_TO_USD_RATE = 1.5;

    for (const tutor of tutors) {
        const { data: sessions } = await supabase.from('Schedules').select('credits_required, status, session_status, session_action').eq('tutor_id', tutor.id);
        const earned = sessions.filter(s => s.status === 'confirmed' && (s.session_status === 'successful' || s.session_action === 'review-submitted')).reduce((sum, s) => sum + parseFloat(s.credits_required || 0), 0);
        
        const { data: withdrawals } = await supabase.from('TutorWithdrawals').select('amount, status, payment_method').eq('tutor_id', tutor.id).in('status', ['pending', 'approved', 'processing', 'completed']);
        
        const rate = (tutor.pricing_region === 'PH') ? CREDIT_TO_PHP_RATE : CREDIT_TO_USD_RATE;
        const withdrawnCredits = withdrawals ? withdrawals.reduce((sum, w) => sum + (parseFloat(w.amount || 0) / rate), 0) : 0;
        
        if (earned > 0 || withdrawnCredits > 0) {
            console.log(`Tutor: ${tutor.email} | Region: ${tutor.pricing_region} | Earned: ${earned} | Withdrawn: ${withdrawnCredits} | Balance: ${earned - withdrawnCredits}`);
        }
    }
}

checkAll();
