
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature');

  let event;

  try {
    if (!webhookSecret) {
        throw new Error('STRIPE_WEBHOOK_SECRET is not set');
    }
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Handle the event
  switch (event.type) {
    case 'account.updated':
      const account = event.data.object;
      const accountId = account.id;
      const arePayoutsEnabled = account.payouts_enabled && account.details_submitted;

      console.log(`Account updated: ${accountId}, Payouts: ${arePayoutsEnabled}`);

      // Update Tutor status in DB
      const { error } = await supabase
        .from('Tutors')
        .update({ stripe_onboarding_complete: arePayoutsEnabled })
        .eq('stripe_account_id', accountId);

      if (error) {
        console.error('Error updating tutor status from webhook:', error);
        return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
      }
      break;
    
    // Add other event types if needed
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  return NextResponse.json({ received: true });
}
