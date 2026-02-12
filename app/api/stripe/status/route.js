
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
      .select('id, stripe_account_id, stripe_onboarding_complete')
      .eq('user_id', user.id)
      .single();

    if (tutorError || !tutor) {
      return NextResponse.json({ error: 'Tutor not found' }, { status: 404 });
    }

    if (!tutor.stripe_account_id) {
        return NextResponse.json({ 
            isConnected: false, 
            isOnboarded: false 
        });
    }

    // 3. Retrieve Stripe Account Details
    const account = await stripe.accounts.retrieve(tutor.stripe_account_id);
    
    // Check if onboarding is complete (payouts enabled is a good proxy)
    const isPayoutsEnabled = account.payouts_enabled;
    const isChargesEnabled = account.charges_enabled;
    const detailsSubmitted = account.details_submitted;

    const isOnboarded = detailsSubmitted && isPayoutsEnabled;

    // 4. Update DB if status changed
    if (isOnboarded !== tutor.stripe_onboarding_complete) {
        await supabase
            .from('Tutors')
            .update({ stripe_onboarding_complete: isOnboarded })
            .eq('id', tutor.id);
    }

    return NextResponse.json({
        isConnected: true,
        isOnboarded: isOnboarded,
        detailsSubmitted: detailsSubmitted,
        payoutsEnabled: isPayoutsEnabled,
        chargesEnabled: isChargesEnabled,
        accountId: tutor.stripe_account_id
    });

  } catch (error) {
    console.error('Stripe Status Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
