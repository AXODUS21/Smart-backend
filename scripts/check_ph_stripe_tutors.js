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

async function checkTutors() {
    console.log('Checking PH Tutors with Stripe payment method...');
    const { data: tutors, error } = await supabase
        .from('Tutors')
        .select('email, payment_method, pricing_region, stripe_account_id')
        .eq('pricing_region', 'PH')
        .eq('payment_method', 'stripe');

    if (error) {
        console.error(error);
        return;
    }

    if (tutors.length === 0) {
        console.log('No PH Tutors found using Stripe.');
    } else {
        console.table(tutors);
    }
}

checkTutors();
