import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const PAYMONGO_BASE_URL = 'https://api.paymongo.com/v1';

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured');
  }

  return createClient(
    supabaseUrl,
    serviceRoleKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

export async function POST(request) {
  try {
    const paymongoSecretKey = process.env.PAYMONGO_SECRET_KEY;
    if (!paymongoSecretKey) {
      console.error('PAYMONGO_SECRET_KEY is not configured');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const { planId, userId } = await request.json();

    if (!planId || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    // Fetch plan details
    const fetchPlan = async () => {
      let { data: planData, error: planError } = await supabase
        .from('credit_plans')
        .select('id, slug, name, credits, price_usd, is_family_pack')
        .eq('slug', planId)
        .eq('is_active', true)
        .maybeSingle();

      if (!planData) {
        const { data: byIdData } = await supabase
          .from('credit_plans')
          .select('id, slug, name, credits, price_usd, is_family_pack')
          .eq('id', planId)
          .eq('is_active', true)
          .maybeSingle();
        planData = byIdData;
      }
      return planData;
    };

    const planData = await fetchPlan();

    if (!planData) {
      return NextResponse.json(
        { error: 'Plan not found or inactive' },
        { status: 404 }
      );
    }

    const credits = planData.credits;
    const price = parseFloat(planData.price_usd);
    
    // Convert USD to PHP (approximate rate or fetch if needed, defaulting to 56 as per existing logic)
    const usdToPhpRate = parseFloat(process.env.USD_TO_PHP_RATE || '56');
    const amountInPhp = price * usdToPhpRate;
    const amountInCentavos = Math.round(amountInPhp * 100);

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    
    // Generate a unique reference for this transaction to verify in success route
    const internalRef = `tm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
    // Pass the internalRef to success URL so we can look up the session ID
    const successUrl = `${baseUrl}/api/payments/paymongo/success?planId=${encodeURIComponent(planData.slug || planData.id)}&credits=${credits}&userId=${userId}&ref=${internalRef}`;
    
    console.log('Creating PayMongo Checkout Session for:', {
        userId,
        planId: planData.slug || planData.id,
        credits,
        internalRef,
        successUrl
    });

    const cancelUrl = `${baseUrl}/?tab=credits&canceled=true`;

    const body = {
      data: {
        attributes: {
          line_items: [
            {
              currency: 'PHP',
              amount: amountInCentavos,
              description: planData.name,
              name: `${planData.credits} Credits`,
              quantity: 1,
              images: [] // Add plan image if available
            }
          ],
          payment_method_types: ['card', 'gcash', 'grab_pay', 'paymaya'],
          success_url: successUrl,
          cancel_url: cancelUrl,
          description: `Purchase of ${planData.credits} credits`,
          reference_number: `ref_${userId}_${Date.now()}`,
          send_email_receipt: true,
          show_description: true,
          show_line_items: true,
          metadata: {
            planId: planData.slug || planData.id,
            credits: credits.toString(),
            userId,
            isFamilyPack: (planData.is_family_pack === true).toString()
          }
        }
      }
    };

    const response = await fetch(`${PAYMONGO_BASE_URL}/checkout_sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Basic ${Buffer.from(paymongoSecretKey + ':').toString('base64')}`,
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('PayMongo Checkout Session Error:', data);
      return NextResponse.json(
        { error: data.errors?.[0]?.detail || 'Failed to create checkout session' },
        { status: response.status }
      );
    }

    const checkoutUrl = data.data.attributes.checkout_url;
    const checkoutSessionId = data.data.id;

    console.log('Got PayMongo Session:', checkoutSessionId);

    // Store the session ID and reference in user metadata for retrieval in success route
    const { error: updateUserError } = await supabase.auth.admin.updateUserById(
      userId,
      {
        user_metadata: {
          paymongo_pending_ref: internalRef,
          paymongo_pending_session_id: checkoutSessionId
        }
      }
    );

    if (updateUserError) {
      console.error('Failed to update user metadata with session ref:', updateUserError);
      // We log but proceed, though verification might fail if ref check is strict.
      // In worst case, success route will fail to find session.
    } else {
        console.log('Updated user metadata with pending session ref:', internalRef);
    }

    return NextResponse.json({
      checkoutUrl
    });

  } catch (error) {
    console.error('Checkout API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
