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

async function inspect() {
    const emails = ['exekert27@gmail.com', 'lodorian2@gmail.com', 'lubi.axellerosh@gmail.com'];
    console.log('Inspecting tutors:', emails);
    const { data: tutors, error } = await supabase
        .from('Tutors')
        .select('email, payment_method, pricing_region, stripe_account_id, stripe_onboarding_complete')
        .in('email', emails);

    if (error) {
        console.error(error);
        return;
    }

    console.table(tutors);
}

inspect();
