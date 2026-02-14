const Stripe = require('stripe');
require('dotenv').config({ path: '.env.local' });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const TRANSFER_ID = 'tr_1T0ZpZDxUUw59nnFkjF8YQdp'; // Automatic Payout #3

async function revertTransfer() {
  try {
      console.log(`Creating reversal for transfer ${TRANSFER_ID}...`);
      const reversal = await stripe.transfers.createReversal(TRANSFER_ID);
      console.log('Reversal created:', reversal.id);
  } catch (err) {
      console.error('Error reversing transfer:', err.message);
  }
}

revertTransfer();
