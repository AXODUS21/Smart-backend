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

async function listTransfers() {
    console.log('Listing last 20 Stripe transfers...');
    try {
        const transfers = await stripe.transfers.list({ limit: 20 });
        if (transfers.data.length === 0) {
            console.log('No transfers found in this Stripe account.');
            return;
        }
        
        console.table(transfers.data.map(t => ({
            id: t.id,
            amount: t.amount / 100,
            currency: t.currency.toUpperCase(),
            destination: t.destination,
            created: new Date(t.created * 1000).toISOString()
        })));
        
    } catch (error) {
        console.error('Error listing transfers:', error.message);
    }
}

listTransfers();
