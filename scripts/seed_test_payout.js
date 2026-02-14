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

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or Key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
    const tutorId = 19; // lyjanenalayog@gmail.com
    const studentId = 37;
    const fakeStripeId = 'acct_1234567890EXTRA'; 

    console.log(`Seeding test data for Tutor ${tutorId}...`);

    // 1. Update Tutor with fake Stripe ID
    const { error: updateError } = await supabase
        .from('Tutors')
        .update({ stripe_account_id: fakeStripeId })
        .eq('id', tutorId);
    
    if (updateError) {
        console.error('Failed to update tutor:', updateError);
        return;
    }
    console.log('Updated tutor stripe_account_id.');

    // 2. Insert Test Session
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60*60*1000);
    
    const { data: session, error: sessError } = await supabase
        .from('Schedules')
        .insert({
            tutor_id: tutorId,
            student_id: studentId,
            status: 'confirmed',
            session_status: 'successful',
            credits_required: 10, // 10 credits
            start_time_utc: oneHourAgo.toISOString(),
            end_time_utc: now.toISOString(),
            duration_min: 60,
            subject: 'Test Subject Payout',
            meeting_link: 'http://test.com'
        })
        .select()
        .single();

    if (sessError) {
        console.error('Failed to insert session:', sessError);
        return;
    }
    console.log(`Inserted test session ID: ${session.id} (10 credits)`);
    console.log('Done! You can now run the payout check again.');
}

seed();
