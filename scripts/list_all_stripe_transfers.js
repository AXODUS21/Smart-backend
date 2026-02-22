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

async function listAll() {
    console.log('Listing last 50 Stripe transfers...');
    const transfers = await stripe.transfers.list({ limit: 50 });
    console.table(transfers.data.map(t => ({
        id: t.id,
        amount: t.amount / 100,
        currency: t.currency.toUpperCase(),
        created: new Date(t.created * 1000).toISOString().split('T')[0]
    })));
    
    const phpTransfers = transfers.data.filter(t => t.currency === 'php');
    console.log('PHP Transfers found:', phpTransfers.length);
}

listAll();
