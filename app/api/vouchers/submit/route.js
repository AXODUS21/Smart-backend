import { NextResponse } from "next/server";
import { requireAuthedUser, serviceRoleClient } from "../_utils";

export async function POST(request) {
  try {
    const { user } = await requireAuthedUser(request);
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized: invalid or expired session token" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const codeRaw = (body?.code || "").toString().trim();
    const code = codeRaw.replace(/\s+/g, " ");
    if (!code) {
      return NextResponse.json({ error: "Voucher code is required" }, { status: 400 });
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

    const { data: inserted, error: insErr } = await supabase
      .from("voucher_requests")
      .insert({
        code,
        principal_user_id: user.id,
        status: "pending",
        credits_amount: 0,
      })
      .select("id, code, status, submitted_at")
      .single();

    if (insErr) {
      // Unique pending constraint
      if (insErr.code === "23505") {
        return NextResponse.json(
          { error: "You already have a pending request for this code." },
          { status: 409 }
        );
      }
      throw insErr;
    }

    return NextResponse.json({ success: true, request: inserted });
  } catch (err) {
    console.error("voucher submit error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to submit voucher" },
      { status: 500 }
    );
  }
}

