
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function GET(request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 1. Authenticate tutor
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get tutor's Stripe account ID
    const { data: tutor, error: tutorError } = await supabase
      .from('Tutors')
      .select('id, stripe_account_id, stripe_onboarding_complete')
      .eq('user_id', user.id)
      .single();

    if (tutorError || !tutor) {
      return NextResponse.json({ error: 'Tutor not found' }, { status: 404 });
    }

    if (!tutor.stripe_account_id) {
      return NextResponse.json({ error: 'No Stripe account connected' }, { status: 400 });
    }

    if (!tutor.stripe_onboarding_complete) {
      return NextResponse.json({ error: 'Stripe onboarding not complete' }, { status: 400 });
    }

    // 3. Generate a one-time Express Dashboard login link
    const loginLink = await stripe.accounts.createLoginLink(tutor.stripe_account_id);

    return NextResponse.json({ url: loginLink.url });

  } catch (error) {
    console.error('Stripe Login Link Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
