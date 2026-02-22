const Stripe = require('stripe');
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

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function checkBalance() {
    console.log('Fetching Stripe Balance...');
    try {
        const balance = await stripe.balance.retrieve();
        console.log('Stripe Balance Details:');
        console.log('Available:');
        balance.available.forEach(b => {
            console.log(`- ${b.amount / 100} ${b.currency.toUpperCase()}`);
        });
        console.log('Pending:');
        balance.pending.forEach(b => {
            console.log(`- ${b.amount / 100} ${b.currency.toUpperCase()}`);
        });
        
        console.log('\nAccount Info:');
        const account = await stripe.accounts.retrieve();
        console.log('ID:', account.id);
        console.log('Business Name:', account.business_profile?.name || 'N/A');
        console.log('Country:', account.country);
        console.log('Default Currency:', account.default_currency);
    } catch (error) {
        console.error('Error fetching balance:', error.message);
    }
}

checkBalance();
