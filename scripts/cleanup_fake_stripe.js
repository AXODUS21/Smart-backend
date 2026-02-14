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

async function cleanup() {
    console.log('Removing fake Stripe ID for kimberlyjanenalayog@gmail.com...');

    const { error } = await supabase
        .from('Tutors')
        .update({ stripe_account_id: null, stripe_onboarding_complete: false })
        .eq('email', 'kimberlyjanenalayog@gmail.com');

    if (error) console.error('Error:', error);
    else console.log('Success! Fake ID removed.');
}

cleanup();
