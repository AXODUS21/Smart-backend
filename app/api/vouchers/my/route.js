import { NextResponse } from "next/server";
import { requireAuthedUser, serviceRoleClient } from "../_utils";

export async function GET(request) {
  try {
    const { user } = await requireAuthedUser(request);
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized: invalid or expired session token" },
        { status: 401 }
      );
    }

    const supabase = serviceRoleClient();

    // Must be a principal account
    const { data: principal, error: pErr } = await supabase
      .from("Principals")
      .select("id, user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (pErr) throw pErr;
    if (!principal) {
      return NextResponse.json({ error: "Forbidden: principal account required" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("voucher_requests")
      .select("id, code, status, credits_amount, submitted_at, decided_at, decision_reason")
      .eq("principal_user_id", user.id)
      .order("submitted_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ requests: data || [] });
  } catch (err) {
    console.error("voucher my list error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to load vouchers" },
      { status: 500 }
    );
  }
}

