const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Simple .env parser
try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      process.env[key] = value;
    }
  });
} catch (e) {
  console.log('Could not load .env.local', e.message);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; 

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTutor() {
    const email = 'lodorian2@gmail.com';
    console.log(`Checking status for ${email}...`);

    const { data: tutor, error } = await supabase
        .from('Tutors')
        .select('*')
        .eq('email', email)
        .single();

    if (error) {
        console.error('Error fetching tutor:', error);
        return;
    }

    console.log('--- Tutor Record ---');
    console.log(`ID: ${tutor.id}`);
    console.log(`User ID: ${tutor.user_id}`);
    console.log(`Stripe Account ID: ${tutor.stripe_account_id}`);
    console.log(`Stripe Onboarding Complete: ${tutor.stripe_onboarding_complete}`);
    console.log(`Payment Method: ${tutor.payment_method}`);
    
    // Check credits
    const { data: sessions } = await supabase
        .from('Schedules')
        .select('credits_required, status, session_status, session_action')
        .eq('tutor_id', tutor.id);

    const totalCreditsEarned = sessions
        .filter(s => 
            s.status === 'confirmed' &&
            (s.session_status === 'successful' || s.session_action === 'review-submitted')
        )
        .reduce((total, session) => total + parseFloat(session.credits_required || 0), 0);
        
    console.log(`Total Earned Credits: ${totalCreditsEarned}`);
    
    // Check withdrawals
    const { data: withdrawals } = await supabase
        .from('TutorWithdrawals')
        .select('amount, status')
        .eq('tutor_id', tutor.id);
        
    const totalWithdrawnCredits = withdrawals
        ? withdrawals
            .filter(w => ['approved', 'processing', 'completed'].includes(w.status))
            .reduce((total, w) => total + parseFloat(w.amount || 0) / 90, 0)
        : 0;

    console.log(`Total Withdrawn Credits: ${totalWithdrawnCredits}`);
    console.log(`Available Credits: ${totalCreditsEarned - totalWithdrawnCredits}`);
    
    if (!tutor.stripe_account_id) {
        console.log('FAIL: No Stripe Account ID');
    } else if ((totalCreditsEarned - totalWithdrawnCredits) < 1) {
        console.log('FAIL: Insufficient Credits');
    } else {
        console.log('PASS: Should be processed');
    }
}

checkTutor();
