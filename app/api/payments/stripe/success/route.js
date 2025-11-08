import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');
    const planId = searchParams.get('planId');
    const credits = parseInt(searchParams.get('credits'));
    const userId = searchParams.get('userId');

    // Get base URL from request
    const url = new URL(request.url);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${url.protocol}//${url.host}`;

    if (!sessionId) {
      return NextResponse.redirect(
        `${baseUrl}/?tab=credits&error=missing_session`
      );
    }

    // Verify the session with Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return NextResponse.redirect(
        `${baseUrl}/?tab=credits&error=payment_not_completed`
      );
    }

    // Update credits in database
    const { data: currentData, error: fetchError } = await supabase
      .from('Students')
      .select('credits')
      .eq('user_id', userId)
      .single();

    if (fetchError) {
      console.error('Error fetching credits:', fetchError);
      return NextResponse.redirect(
        `${baseUrl}/?tab=credits&error=fetch_error`
      );
    }

    const currentCredits = currentData?.credits || 0;
    const newCredits = currentCredits + credits;

    const { error: updateError } = await supabase
      .from('Students')
      .update({ credits: newCredits })
      .eq('user_id', userId);

    if (updateError) {
      console.error('Error updating credits:', updateError);
      return NextResponse.redirect(
        `${baseUrl}/?tab=credits&error=update_error`
      );
    }
    
    // Redirect to credits page with success message
    return NextResponse.redirect(
      `${baseUrl}/?tab=credits&success=true&credits=${credits}`
    );
  } catch (error) {
    console.error('Stripe success handler error:', error);
    const url = new URL(request.url);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${url.protocol}//${url.host}`;
    return NextResponse.redirect(
      `${baseUrl}/?tab=credits&error=processing_error`
    );
  }
}

