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

async function debugRPC() {
    const email = 'lodorian2@gmail.com'; // A known tutor email from grease script search
    console.log(`Debugging RPC for ${email}...`);
    
    const { data: allUsers, error: rpcError } = await supabase.rpc('get_all_users_for_admin');
    
    if (rpcError) {
        console.error('RPC Error:', rpcError);
        return;
    }
    
    const tutorFromRPC = allUsers.find(u => u.email === email);
    console.log('Tutor data from RPC:', tutorFromRPC);
    
    if (tutorFromRPC) {
        const { data: tutorFromTable, error: tableError } = await supabase
            .from('Tutors')
            .select('credits')
            .eq('user_id', tutorFromRPC.id)
            .single();
            
        console.log('Tutor data from Tutors table:', tutorFromTable);
        
        if (tutorFromRPC.credits !== tutorFromTable.credits) {
            console.log('DISCREPANCY FOUND!');
            console.log(`RPC credits: ${tutorFromRPC.credits}`);
            console.log(`Table credits: ${tutorFromTable.credits}`);
        } else {
            console.log('No discrepancy found between RPC and Tutors table credits.');
        }
    }
}

debugRPC();
