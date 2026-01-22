import { NextResponse } from "next/server";
import { requireAuthedUser, serviceRoleClient } from "../../../vouchers/_utils";

async function requireSuperadmin(supabase, userId) {
  const { data: sa, error } = await supabase
    .from("superadmins")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return Boolean(sa);
}

function normalizeEmail(raw) {
  if (!raw) return "";
  return raw.toString().trim().toLowerCase();
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

    const isSuperadmin = await requireSuperadmin(supabase, user.id);
    if (!isSuperadmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const principalEmail = normalizeEmail(body?.principalEmail);
    const creditsAmount = Number(body?.creditsAmount);
    const decisionReason = (body?.reason || "").toString().trim() || null;
    const providedCode = (body?.code || "").toString().trim();

    if (!principalEmail) {
      return NextResponse.json(
        { error: "principalEmail is required" },
        { status: 400 }
      );
    }

    if (!creditsAmount || !Number.isFinite(creditsAmount) || creditsAmount <= 0) {
      return NextResponse.json(
        { error: "creditsAmount must be a positive number" },
        { status: 400 }
      );
    }

    const { data: principal, error: pErr } = await supabase
      .from("Principals")
      .select("id, user_id, credits, email")
      .eq("email", principalEmail)
      .maybeSingle();
    if (pErr) throw pErr;
    if (!principal) {
      return NextResponse.json(
        { error: "Principal not found for that email" },
        { status: 404 }
      );
    }

    const newCredits = Number(principal.credits || 0) + creditsAmount;
    const now = new Date().toISOString();

    const { error: updErr } = await supabase
      .from("Principals")
      .update({ credits: newCredits })
      .eq("id", principal.id);
    if (updErr) throw updErr;

    const auditCode =
      providedCode || `MANUAL-${Date.now().toString(36).toUpperCase()}`;

    const { error: insErr } = await supabase.from("voucher_requests").insert({
      code: auditCode,
      principal_user_id: principal.user_id,
      status: "approved",
      credits_amount: creditsAmount,
      submitted_at: now,
      decided_at: now,
      decided_by: user.id,
      decision_reason: decisionReason || "Manual credit by superadmin",
    });

    if (insErr && insErr.code !== "23505") {
      // Ignore duplicate code errors by design; all other errors should bubble
      throw insErr;
    }

    return NextResponse.json({
      success: true,
      newBalance: newCredits,
      principal: {
        id: principal.id,
        user_id: principal.user_id,
        email: principal.email,
      },
    });
  } catch (err) {
    console.error("admin voucher grant error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to grant credits" },
      { status: 500 }
    );
  }
}


