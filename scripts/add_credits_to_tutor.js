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

async function addCredits(email, credits) {
    console.log(`Adding ${credits} credits to ${email}...`);

    // 1. Get Tutor ID
    const { data: tutor, error: tutorError } = await supabase
        .from('Tutors')
        .select('id')
        .eq('email', email)
        .single();
    
    if (tutorError || !tutor) {
        console.error('Error finding tutor:', tutorError ? tutorError.message : 'Tutor not found');
        return;
    }
    console.log(`Found Tutor ID: ${tutor.id}`);

    // 2. Get a random student ID (just for the constraint)
    const { data: student, error: studentError } = await supabase
        .from('Students')
        .select('id')
        .limit(1)
        .single();
    
    if (studentError || !student) {
        console.error('Error finding a student:', studentError);
        return;
    }

    // 3. Insert Session
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60*60*1000);
    
    const { data: session, error: sessError } = await supabase
        .from('Schedules')
        .insert({
            tutor_id: tutor.id,
            student_id: student.id,
            status: 'confirmed',
            session_status: 'successful',
            credits_required: credits,
            start_time_utc: oneHourAgo.toISOString(),
            end_time_utc: now.toISOString(),
            duration_min: 60,
            subject: 'Manual Credit Addition',
            meeting_link: 'http://test.com'
        })
        .select()
        .single();

    if (sessError) {
        console.error('Failed to insert session:', sessError);
        return;
    }
    console.log(`Successfully added ${credits} credits! Session ID: ${session.id}`);
}

// Run for the specific user
addCredits('lodorian2@gmail.com', 100); // Adding 100 credits
