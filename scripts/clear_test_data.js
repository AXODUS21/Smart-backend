const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Order is important to avoid FK constraint errors 
// Child tables first
const tablesToClear = [
  'admintasks',
  'Reviews',
  'Schedules',
  'transactions',
  'manual_topup_requests',
  'voucher_requests',
  'PayoutReports',
  'TutorWithdrawals',
  'assignments',
  'Assignments',
  'TutorApplications',
  'Tutors',
  'Students',
  'Schools',
  'Principals',
  'Announcements'
];

async function clearTable(tableName) {
  console.log(`Clearing ${tableName}...`);
  
  // To handle tables without 'id' column, we can do a trick: we filter by somewhat universal fields or just fetch them and see.
  let { data, error } = await supabase.from(tableName).select('id').limit(1000);
  
  if (error) {
    if (error.code === '42P01') {
      console.log(`Table ${tableName} does not exist, skipping.`);
      return;
    }
    if (error.message && error.message.includes('Could not find the public.Assignments view')) {
      console.log(`Table ${tableName} does not exist, skipping.`);
      return;
    }
    
    // Fallback if 'id' column doesn't exist
    if (error.message && error.message.includes('find the column')) {
       console.log(`No 'id' column in ${tableName}. Trying to clear by fetching everything...`);
       const res = await supabase.from(tableName).select('*').limit(1);
       if (res.data && res.data.length > 0) {
           console.log(`Table ${tableName} has data but no 'id'. Check schema to delete manually.`);
       } else {
           console.log(`Table ${tableName} is empty.`);
       }
       return;
    }
    
    console.error(`Error fetching ${tableName}:`, error.message);
    return;
  }
  
  if (data && data.length > 0) {
    const ids = data.map(r => r.id);
    const delRes = await supabase.from(tableName).delete().in('id', ids);
    if (delRes.error) {
       console.error(`Error deleting from ${tableName}:`, delRes.error.message);
    } else {
       console.log(`Deleted ${data.length} rows from ${tableName}.`);
       if (data.length === 1000) {
          await clearTable(tableName); // Recursive call for remaining rows
       }
    }
  } else {
    console.log(`${tableName} is already empty.`);
  }
}

async function run() {
  for (const table of tablesToClear) {
    await clearTable(table);
  }
  console.log('Finished clearing test data. Ready for live!');
}

run();
