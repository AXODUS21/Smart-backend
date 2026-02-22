/**
 * Updates all existing connected Stripe Express accounts
 * from 'manual' payout schedule to 'daily'.
 *
 * Run: node scripts/update_stripe_payout_schedules.js
 * Dry run: node scripts/update_stripe_payout_schedules.js --dry-run
 */

const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

// Load .env.local
try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^[\"']|[\"']$/g, '');
      process.env[key] = value;
    }
  });
} catch (e) {
  console.log('Could not load .env.local:', e.message);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const isDryRun = process.argv.includes('--dry-run');

async function updatePayoutSchedules() {
  console.log(`\n🔧 Stripe Payout Schedule Updater (${isDryRun ? 'DRY RUN' : 'LIVE'})`);
  console.log('='.repeat(50));

  // 1. Fetch all tutors with a connected Stripe account
  const { data: tutors, error } = await supabase
    .from('Tutors')
    .select('id, email, first_name, last_name, stripe_account_id, stripe_onboarding_complete')
    .not('stripe_account_id', 'is', null);

  if (error) {
    console.error('❌ Failed to fetch tutors:', error.message);
    process.exit(1);
  }

  console.log(`\nFound ${tutors.length} tutor(s) with Stripe accounts.\n`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const tutor of tutors) {
    const name = `${tutor.first_name || ''} ${tutor.last_name || ''}`.trim() || tutor.email;
    try {
      // Retrieve current account settings
      const account = await stripe.accounts.retrieve(tutor.stripe_account_id);
      const currentInterval = account.settings?.payouts?.schedule?.interval;

      if (currentInterval === 'daily') {
        console.log(`✅ [SKIP] ${name} (${tutor.stripe_account_id}) — already 'daily'`);
        skipped++;
        continue;
      }

      console.log(`🔄 ${name} (${tutor.stripe_account_id}) — current: '${currentInterval}' → updating to 'daily'`);

      if (!isDryRun) {
        await stripe.accounts.update(tutor.stripe_account_id, {
          settings: {
            payouts: {
              schedule: { interval: 'daily' },
            },
          },
        });
        console.log(`   ✅ Updated successfully.`);
      } else {
        console.log(`   [DRY RUN] Would update to daily.`);
      }

      updated++;
    } catch (err) {
      console.error(`   ❌ Failed for ${name}: ${err.message}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`📊 Summary:`);
  console.log(`   Updated : ${updated}`);
  console.log(`   Skipped : ${skipped} (already daily)`);
  console.log(`   Failed  : ${failed}`);
  if (isDryRun) console.log('\n⚠️  DRY RUN — no changes were made. Remove --dry-run to apply.');
  console.log('');
}

updatePayoutSchedules().catch(console.error);
