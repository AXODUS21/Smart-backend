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

async function topUpPHP() {
    console.log('Topping up PHP balance in Stripe Test Mode...');
    try {
        // In test mode, creating a charge with a test card adds to the available balance
        const charge = await stripe.charges.create({
            amount: 5000000, // 50,000 PHP
            currency: 'php',
            source: 'tok_visa', // Standard test token
            description: 'Test balance top-up (PHP)',
        });
        console.log(`Success! Charged ${charge.amount / 100} PHP. ID: ${charge.id}`);
        console.log('Wait a few seconds for Stripe to update the "Available" balance.');
    } catch (error) {
        console.error('Error topping up:', error.message);
    }
}

topUpPHP();
