const Stripe = require('stripe');
const path = require('path');
const fs = require('fs');

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

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const ACCOUNT_ID = 'acct_1T0axPRlaadC94fF'; // The current tutor's account

async function checkAccount() {
    try {
        console.log(`Fetching account ${ACCOUNT_ID}...`);
        const account = await stripe.accounts.retrieve(ACCOUNT_ID);
        
        console.log('--- Account Details ---');
        console.log('ID:', account.id);
        console.log('Type:', account.type);
        console.log('Payouts Enabled:', account.payouts_enabled);
        console.log('Charges Enabled:', account.charges_enabled);
        console.log('Details Submitted:', account.details_submitted);
        
        console.log('\n--- External Accounts (Bank/Card) ---');
        if (account.external_accounts && account.external_accounts.data) {
            console.log(JSON.stringify(account.external_accounts.data, null, 2));
        } else {
            console.log('No external accounts found (or field is missing).');
        }

    } catch (error) {
        console.error('Error fetching account:', error);
    }
}

checkAccount();
