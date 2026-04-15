export async function POST(request) {
  const { NextResponse } = await import("next/server");
  return NextResponse.json(
    {
      error:
        "PayMongo checkout has been removed. Please use the GCash QR option and send proof via Facebook Messenger for manual verification.",
      messenger: "https://www.facebook.com/smart.brain.5059",
      qrImagePath: "/gcashqr.jpg",
    },
    { status: 410 }
  );
}
