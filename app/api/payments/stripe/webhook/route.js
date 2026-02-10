import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(req) {
  const payload = await req.text();
  const sig = req.headers.get('stripe-signature');

  letevent;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(payload, sig, endpointSecret);
  } catch (err) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  // Handle the event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    // Initialize Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    try {
      // Extract data from session
      const amount = session.amount_total / 100; // Convert cents to main unit
      const currency = session.currency.toUpperCase();
      const userId = session.metadata.userId;
      const planId = session.metadata.planId;
      const credits = session.metadata.credits;

      // Record transaction
      const { error } = await supabase.from('Transactions').insert({
        user_id: userId,
        amount: amount,
        currency: currency,
        source: 'stripe',
        transaction_id: session.payment_intent, // Store payment intent ID
        status: 'succeeded',
        plan_id: planId,
        credits_amount: credits,
        email: session.customer_details?.email // Store email as backup
      });

      if (error) {
        console.error('Error recording Stripe transaction:', error);
        return NextResponse.json({ error: 'Database insert failed' }, { status: 500 });
      }

      console.log(`Recorded Stripe transaction: ${session.id}`);
    } catch (err) {
      console.error('Error processing checkout session:', err);
      return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}

export const config = {
  api: {
    bodyParser: false, // Stripe requires raw body
  },
};
