import { NextResponse } from "next/server";
import { requireAuthedUser, serviceRoleClient } from "@/app/api/vouchers/_utils";

export async function POST(request) {
  try {
    const { user } = await requireAuthedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { userId, planId, referenceCode } = body || {};

    if (!userId || !planId || !referenceCode) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (user.id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = serviceRoleClient();

    // Ensure this is a STUDENT (do not touch principal logic)
    const { data: student, error: studentErr } = await supabase
      .from("Students")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (studentErr) {
      return NextResponse.json(
        { error: "Failed to verify student account" },
        { status: 500 }
      );
    }
    if (!student) {
      return NextResponse.json(
        { error: "This flow is only available for student accounts" },
        { status: 422 }
      );
    }

    const isUuid = (value) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        String(value || "")
      );

    let plan = null;
    let planErr = null;

    // Try slug first (safe for non-UUID plan identifiers)
    {
      const { data, error } = await supabase
        .from("credit_plans")
        .select("id, slug, name, credits, region, price_php, price_usd")
        .eq("slug", planId)
        .eq("is_active", true)
        .maybeSingle();
      plan = data;
      planErr = error;
    }

    // If not found by slug, try UUID id only when valid UUID
    if (!plan && !planErr && isUuid(planId)) {
      const { data, error } = await supabase
        .from("credit_plans")
        .select("id, slug, name, credits, region, price_php, price_usd")
        .eq("id", planId)
        .eq("is_active", true)
        .maybeSingle();
      plan = data;
      planErr = error;
    }

    if (planErr) {
      console.error("Manual top-up plan lookup error:", planErr);
      return NextResponse.json(
        { error: "Failed to load plan" },
        { status: 500 }
      );
    }
    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const credits = Number(plan.credits || 0);
    const currency = plan.region === "PH" ? "php" : "usd";
    const amountRaw = plan.region === "PH" ? plan.price_php : plan.price_usd;
    const amount = Number(amountRaw || 0);

    if (!Number.isFinite(credits) || credits <= 0) {
      return NextResponse.json(
        { error: "Invalid plan credits" },
        { status: 422 }
      );
    }

    const { data: inserted, error: insertErr } = await supabase
      .from("manual_topup_requests")
      .insert({
        user_id: userId,
        plan_id: plan.slug || plan.id,
        plan_name: plan.name || null,
        credits,
        amount,
        currency,
        reference_code: referenceCode,
        status: "pending",
      })
      .select("id, status, reference_code, created_at")
      .single();

    if (insertErr) {
      const isDuplicate =
        String(insertErr.message || "").toLowerCase().includes("duplicate") ||
        String(insertErr.code || "").toLowerCase().includes("23505");
      return NextResponse.json(
        {
          error: isDuplicate
            ? "That reference code was already submitted. Please generate a new one and try again."
            : "Failed to create request",
        },
        { status: isDuplicate ? 409 : 500 }
      );
    }

    return NextResponse.json({ success: true, request: inserted });
  } catch (error) {
    console.error("Manual top-up request error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

