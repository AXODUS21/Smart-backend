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
      const value = match[2].trim().replace(/^["']|["']$/g, ''); // strip quotes
      process.env[key] = value;
    }
  });
} catch (e) {
  console.log('Could not load .env.local', e.message);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service role for admin access

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or Key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('--- Starting Payout Debug ---');
  
  // 1. Fetch Tutors
  const { data: tutors, error } = await supabase.from('Tutors').select('*');
  if (error) {
    console.error('Error fetching tutors:', error);
    return;
  }
  console.log(`Found ${tutors.length} tutors.`);

  for (const tutor of tutors) {
    console.log(`\nChecking Tutor: ${tutor.email} (ID: ${tutor.id})`);
    console.log(`Stripe Account: ${tutor.stripe_account_id || 'NOT CONNECTED'}`);

    if (!tutor.stripe_account_id) {
        console.log('-> WARNING: No Stripe Connect Account (Logic would skip, but checking credits for debug)');
        // continue; 
    }

    // 2. Fetch Sessions
    const { data: sessions, error: sessError } = await supabase
      .from('Schedules')
      .select('credits_required, status, session_status, session_action')
      .eq('tutor_id', tutor.id);
    
    if (sessError) {
        console.error('Error fetching sessions:', sessError);
        continue;
    }

    const eligibleSessions = sessions.filter(s => 
        s.status === 'confirmed' && 
        (s.session_status === 'successful' || s.session_action === 'review-submitted')
    );
    
    const totalEarned = eligibleSessions.reduce((sum, s) => sum + parseFloat(s.credits_required || 0), 0);
    console.log(`Total Earned: ${totalEarned} credits (${eligibleSessions.length} sessions)`);

    // 3. Fetch Withdrawals
    // Note: status check matches route.js: approved, processing, completed
    const { data: withdrawals, error: withError } = await supabase
        .from('TutorWithdrawals')
        .select('amount, status')
        .eq('tutor_id', tutor.id)
        .in('status', ['approved', 'processing', 'completed']);
    
    if (withError) {
        console.error('Error fetching withdrawals:', withError);
        continue;
    }

    const totalWithdrawnAmount = withdrawals.reduce((sum, w) => sum + parseFloat(w.amount || 0), 0);
    const totalWithdrawnCredits = totalWithdrawnAmount / 90; 
    console.log(`Total Withdrawn: ${totalWithdrawnAmount} PHP (~${totalWithdrawnCredits.toFixed(2)} credits)`);

    const netAvailable = totalEarned - totalWithdrawnCredits;
    console.log(`Net Available: ${netAvailable.toFixed(2)} credits`);

    if (netAvailable >= 1) { // Threshold
        console.log('-> ELIGIBLE FOR PAYOUT');
    } else {
        console.log('-> NOT ELIGIBLE: Below threshold (< 1 credit)');
    }
  }
}

main();
