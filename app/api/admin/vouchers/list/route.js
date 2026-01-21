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
    const role = await requireAdminOrSuperadmin(supabase, user.id);
    if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { data, error } = await supabase
      .from("voucher_requests")
      .select(
        "id, code, status, credits_amount, submitted_at, decided_at, decision_reason, principal_user_id"
      )
      .order("submitted_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ requests: data || [] });
  } catch (err) {
    console.error("admin voucher list error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to load voucher requests" },
      { status: 500 }
    );
  }
}

