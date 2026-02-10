
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Admin Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey);

// Initialize Payment Providers
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const PAYMONGO_SECRET_KEY = process.env.PAYMONGO_SECRET_KEY;

export async function POST(req) {
  try {
    // Basic security check (add your own admin check logic here)
    const { secret } = await req.json();
    if (secret !== process.env.CRON_SECRET && secret !== 'admin-backfill-secret') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results = {
      stripe: { added: 0, skipped: 0, errors: [] },
      paymongo: { added: 0, skipped: 0, errors: [] }
    };

    // --- 1. Backfill Stripe ---
    console.log('Starting Stripe backfill...');
    let hasMore = true;
    let lastId = null;

    while (hasMore) {
      const listParams = { limit: 100 };
      if (lastId) listParams.starting_after = lastId;

      const payments = await stripe.paymentIntents.list(listParams);
      
      for (const pi of payments.data) {
        if (pi.status === 'succeeded') {
          // Check if exists
          const { data: existing } = await supabase
            .from('Transactions')
            .select('id')
            .eq('transaction_id', pi.id)
            .maybeSingle();

          if (!existing) {
            const amount = pi.amount / 100;
            const currency = pi.currency.toUpperCase();
            const userId = pi.metadata.userId || null;
            const planId = pi.metadata.planId || null;
            const credits = pi.metadata.credits || null;

            const { error } = await supabase.from('Transactions').insert({
              user_id: userId,
              amount,
              currency,
              source: 'stripe',
              transaction_id: pi.id,
              status: 'succeeded',
              plan_id: planId,
              credits_amount: credits,
              created_at: new Date(pi.created * 1000).toISOString()
            });

            if (error) results.stripe.errors.push({ id: pi.id, error });
            else results.stripe.added++;
          } else {
            results.stripe.skipped++;
          }
        }
      }

      hasMore = payments.has_more;
      if (payments.data.length > 0) {
        lastId = payments.data[payments.data.length - 1].id;
      } else {
        hasMore = false;
      }
    }

    // --- 2. Backfill PayMongo ---
    // Note: PayMongo list API might have pagination differently. 
    // Simplified loop for PayMongo (assumes < 100 recent payments or simple implementation)
    console.log('Starting PayMongo backfill...');
    const paymongoResponse = await fetch('https://api.paymongo.com/v1/payments?limit=100', {
      headers: {
        Authorization: `Basic ${Buffer.from(PAYMONGO_SECRET_KEY + ':').toString('base64')}`,
        accept: 'application/json'
      }
    });

    if (paymongoResponse.ok) {
      const pmData = await paymongoResponse.json();
      for (const payment of pmData.data) {
        if (payment.attributes.status === 'paid') {
             // Check if exists
             const { data: existing } = await supabase
             .from('Transactions')
             .select('id')
             .eq('transaction_id', payment.id)
             .maybeSingle();

           if (!existing) {
             const attr = payment.attributes;
             const amount = attr.amount / 100;
             const currency = attr.currency.toUpperCase();
             const metadata = attr.metadata || {};
             
             const { error } = await supabase.from('Transactions').insert({
               user_id: metadata.userId || null,
               amount,
               currency,
               source: 'paymongo',
               transaction_id: payment.id,
               status: 'succeeded',
               plan_id: metadata.planId || null,
               credits_amount: metadata.credits || null,
               created_at: new Date(attr.paid_at * 1000).toISOString()
             });

             if (error) results.paymongo.errors.push({ id: payment.id, error });
             else results.paymongo.added++;
           } else {
             results.paymongo.skipped++;
           }
        }
      }
    } else {
        results.paymongo.errors.push("Failed to fetch from PayMongo API");
    }

    return NextResponse.json({ success: true, results });

  } catch (error) {
    console.error('Backfill error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
