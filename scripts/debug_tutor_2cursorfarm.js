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

async function checkTutor() {
    console.log('Checking tutor 2cursorfarm@gmail.com...');
    const { data: tutor, error } = await supabase
        .from('Tutors')
        .select('*')
        .eq('email', '2cursorfarm@gmail.com')
        .single();

    if (error) {
        console.error(error);
        return;
    }

    console.log('Tutor Details:');
    console.log('id:', tutor.id);
    console.log('email:', tutor.email);
    console.log('payment_method:', tutor.payment_method);
    console.log('stripe_account_id:', tutor.stripe_account_id);
    console.log('stripe_onboarding_complete:', tutor.stripe_onboarding_complete);
    console.log('pricing_region:', tutor.pricing_region);
    console.log('bank_account_number:', tutor.bank_account_number);
    console.log('bank_name:', tutor.bank_name);
}

checkTutor();
