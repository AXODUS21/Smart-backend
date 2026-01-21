import { NextResponse } from "next/server";
import { requireAuthedUser, serviceRoleClient } from "../../../vouchers/_utils";

async function requireAdminOrSuperadmin(supabase, userId) {
  const { data: sa } = await supabase
    .from("superadmins")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (sa) return { role: "superadmin" };

  const { data: a } = await supabase
    .from("admins")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (a) return { role: "admin" };

  return null;
}

export async function POST(request) {
  try {
    const { user } = await requireAuthedUser(request);
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized: invalid or expired session token" },
        { status: 401 }
      );
    }

    const supabase = serviceRoleClient();
    const role = await requireAdminOrSuperadmin(supabase, user.id);
    if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const requestId = Number(body?.requestId);
    const action = (body?.action || "").toString();
    const creditsAmountRaw = body?.creditsAmount;
    const decisionReason = (body?.reason || "").toString().trim() || null;

    if (!requestId || !Number.isFinite(requestId)) {
      return NextResponse.json({ error: "requestId is required" }, { status: 400 });
    }
    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ error: "action must be approve or reject" }, { status: 400 });
    }

    // Load request
    const { data: reqRow, error: reqErr } = await supabase
      .from("voucher_requests")
      .select("id, status, principal_user_id, code")
      .eq("id", requestId)
      .single();
    if (reqErr) throw reqErr;

    if (reqRow.status !== "pending") {
      return NextResponse.json(
        { error: `Request already ${reqRow.status}` },
        { status: 409 }
      );
    }

    if (action === "reject") {
      const { error: updErr } = await supabase
        .from("voucher_requests")
        .update({
          status: "rejected",
          decided_by: user.id,
          decided_at: new Date().toISOString(),
          decision_reason: decisionReason,
          credits_amount: 0,
        })
        .eq("id", requestId);
      if (updErr) throw updErr;
      return NextResponse.json({ success: true });
    }

    // Approve
    const creditsAmount = Number(creditsAmountRaw);
    if (!creditsAmount || creditsAmount <= 0) {
      return NextResponse.json(
        { error: "creditsAmount must be a positive number when approving" },
        { status: 400 }
      );
    }

    // Load principal credits
    const { data: principal, error: pErr } = await supabase
      .from("Principals")
      .select("id, credits")
      .eq("user_id", reqRow.principal_user_id)
      .single();
    if (pErr) throw pErr;

    const newCredits = Number(principal.credits || 0) + creditsAmount;

    // Update principal credits
    const { error: pUpdErr } = await supabase
      .from("Principals")
      .update({ credits: newCredits })
      .eq("id", principal.id);
    if (pUpdErr) throw pUpdErr;

    // Mark request approved
    const { error: rUpdErr } = await supabase
      .from("voucher_requests")
      .update({
        status: "approved",
        credits_amount: creditsAmount,
        decided_by: user.id,
        decided_at: new Date().toISOString(),
        decision_reason: decisionReason,
      })
      .eq("id", requestId);
    if (rUpdErr) throw rUpdErr;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("admin voucher process error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to process voucher request" },
      { status: 500 }
    );
  }
}

