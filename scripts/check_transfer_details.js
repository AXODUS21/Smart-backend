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

async function checkDetails() {
    console.log('Fetching details for tr_1T0b91DrQNVjGHrq8WThFUK3...');
    const transfer = await stripe.transfers.retrieve('tr_1T0b91DrQNVjGHrq8WThFUK3');
    console.log(JSON.stringify(transfer, null, 2));
}

checkDetails();
