import { NextResponse } from "next/server";

const PAYMONGO_BASE_URL = "https://api.paymongo.com/v1";

export async function POST(request) {
  try {
    const paymongoSecretKey = process.env.PAYMONGO_SECRET_KEY;
    if (!paymongoSecretKey) {
      console.error("PAYMONGO_SECRET_KEY is not configured");
      return NextResponse.json(
        {
          error:
            "PayMongo secret key not configured. Please check your environment variables.",
        },
        { status: 500 }
      );
    }

    const body = await request.json();
    const {
      cardNumber,
      expMonth,
      expYear,
      cvc,
      billing = {},
    } = body || {};

    if (!cardNumber || !expMonth || !expYear || !cvc) {
      return NextResponse.json(
        { error: "Incomplete card details provided." },
        { status: 400 }
      );
    }

    const paymentMethodResponse = await fetch(
      `${PAYMONGO_BASE_URL}/payment_methods`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Basic ${Buffer.from(
            paymongoSecretKey + ":"
          ).toString("base64")}`,
        },
        body: JSON.stringify({
          data: {
            attributes: {
              type: "card",
              details: {
                card_number: cardNumber,
                exp_month: parseInt(expMonth, 10),
                exp_year: parseInt(expYear, 10),
                cvc,
              },
              billing,
            },
          },
        }),
      }
    );

    const json = await paymentMethodResponse.json();

    if (!paymentMethodResponse.ok) {
      console.error("PayMongo payment_method error:", json);
      return NextResponse.json(
        {
          error:
            json?.errors?.[0]?.detail ||
            json?.errors?.[0]?.title ||
            "Failed to create payment method",
        },
        { status: paymentMethodResponse.status }
      );
    }

    const paymentMethodId = json?.data?.id;

    return NextResponse.json({
      paymentMethodId,
      raw: json,
    });
  } catch (error) {
    console.error("PayMongo create-payment-method error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create payment method" },
      { status: 500 }
    );
  }
}


















