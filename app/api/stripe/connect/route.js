
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 1. Get current user
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get Tutor record
    const { data: tutor, error: tutorError } = await supabase
      .from('Tutors')
      .select('id, email, first_name, last_name, stripe_account_id')
      .eq('user_id', user.id)
      .single();

    if (tutorError || !tutor) {
      return NextResponse.json({ error: 'Tutor not found' }, { status: 404 });
    }

    let accountId = tutor.stripe_account_id;

    // 3. Create Stripe Account if not exists
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'PH', // Defaulting to Philippines based on context
        email: tutor.email,
        capabilities: {
          transfers: { requested: true },
        },
        business_type: 'individual',
        individual: {
            first_name: tutor.first_name,
            last_name: tutor.last_name,
            email: tutor.email,
        }
      });

      accountId = account.id;

      // Save to DB
      await supabase
        .from('Tutors')
        .update({ stripe_account_id: accountId })
        .eq('id', tutor.id);
    }

    // 4. Create Account Link
    const origin = request.headers.get('origin') || 'http://localhost:3000'; // Fallback for dev
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/tutor/dashboard?refresh=true`,
      return_url: `${origin}/tutor/dashboard?success=true`,
      type: 'account_onboarding',
    });

    return NextResponse.json({ url: accountLink.url });

  } catch (error) {
    console.error('Stripe Connect Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
