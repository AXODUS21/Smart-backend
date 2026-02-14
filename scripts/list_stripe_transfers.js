const Stripe = require('stripe');
require('dotenv').config({ path: '.env.local' });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function listTransfers() {
  const transfers = await stripe.transfers.list({ limit: 5 });
  transfers.data.forEach(t => {
      console.log(`ID: ${t.id}, Amount: ${t.amount}, Created: ${new Date(t.created * 1000).toLocaleString()}, Description: ${t.description}`);
  });
}

listTransfers();
