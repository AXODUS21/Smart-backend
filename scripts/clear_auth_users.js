require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log('Fetching superadmins...');
  const { data: superadmins, error: superErr } = await supabase.from('superadmins').select('id');
  if (superErr) console.error('Error fetching superadmins:', superErr);
  
  console.log('Fetching admins...');
  const { data: admins, error: adminErr } = await supabase.from('admins').select('id');
  if (adminErr) console.error('Error fetching admins:', adminErr);

  const preservedIds = new Set([
    ...(superadmins || []).map(r => r.id),
    ...(admins || []).map(r => r.id)
  ]);
  
  console.log(`Found ${preservedIds.size} admin/superadmin accounts to preserve.`);

  let allUsers = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const { data: authData, error: authErr } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (authErr) {
      console.error('Error fetching auth users:', authErr);
      return;
    }
    
    if (authData && authData.users && authData.users.length > 0) {
      allUsers = allUsers.concat(authData.users);
      page++;
    } else {
      hasMore = false;
    }
  }

  console.log(`Found ${allUsers.length} total users in Auth.`);
  
  let deletedCount = 0;
  for (const u of allUsers) {
    if (!preservedIds.has(u.id)) {
      const { error: delErr } = await supabase.auth.admin.deleteUser(u.id);
      if (delErr) {
        console.error(`Error deleting user ${u.id} (${u.email}):`, delErr);
      } else {
        console.log(`Deleted user ${u.email}`);
        deletedCount++;
      }
    } else {
      console.log(`Skipping preserved admin user: ${u.email}`);
    }
  }

  console.log(`\nFinished clearing non-admin Auth users! Deleted: ${deletedCount}`);
}

run();
