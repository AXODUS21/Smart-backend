const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

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
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkRegions() {
  const { data, error } = await supabase
    .from('Tutors')
    .select('pricing_region, email')
    .limit(50);
    
  if (error) {
    console.error(error);
    return;
  }
  
  const regions = {};
  data.forEach(t => {
    const r = t.pricing_region || 'NULL';
    if (!regions[r]) regions[r] = 0;
    regions[r]++;
  });
  
  console.log('Region distribution:', regions);
  console.log('Sample data:', data.slice(0, 5));
}

checkRegions();
