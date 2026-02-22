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

const CREDIT_TO_PHP_RATE = 90;

async function checkTutorCredits() {
    const email = 'lodorian2@gmail.com';
    console.log(`Checking credits for ${email}...`);
    
    const { data: tutor, error: tError } = await supabase
        .from('Tutors')
        .select('id')
        .eq('email', email)
        .single();
    
    if (tError || !tutor) {
        // Fallback for case sensitivity or missing record
        const { data: tutors } = await supabase.from('Tutors').select('id, email').ilike('email', email);
        if (tutors && tutors.length > 0) {
           tutor = tutors[0];
        } else {
            console.error('Tutor not found');
            return;
        }
    }
    
    const tutorId = tutor.id;
    
    // Earned
    const { data: sessions } = await supabase
      .from('Schedules')
      .select('credits_required, status, session_status, session_action')
      .eq('tutor_id', tutorId);

    const totalCreditsEarned = sessions
      ? sessions
          .filter(
            (s) =>
              s.status === 'confirmed' &&
              (s.session_status === 'successful' || s.session_action === 'review-submitted')
          )
          .reduce((total, session) => total + parseFloat(session.credits_required || 0), 0)
      : 0;

    // Withdrawn
    const { data: withdrawals } = await supabase
      .from('TutorWithdrawals')
      .select('amount, status')
      .eq('tutor_id', tutorId)
      .in('status', ['pending', 'approved', 'processing', 'completed']);

    const totalWithdrawnCredits = withdrawals
      ? withdrawals.reduce((total, w) => total + parseFloat(w.amount || 0) / CREDIT_TO_PHP_RATE, 0)
      : 0;

    console.log(`Total Credits Earned: ${totalCreditsEarned}`);
    console.log(`Total Credits Withdrawn (existing records): ${totalWithdrawnCredits}`);
    console.log(`Available Credits (Calculated): ${totalCreditsEarned - totalWithdrawnCredits}`);
    
    if (withdrawals) {
        console.log('Existing withdrawals:', withdrawals);
    }
}

checkTutorCredits();
