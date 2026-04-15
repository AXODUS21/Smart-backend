import { NextResponse } from "next/server";
import { requireAuthedUser, serviceRoleClient } from "@/app/api/vouchers/_utils";

async function requireAdminOrSuperadmin(supabase, userId) {
  const [adminCheck, superAdminCheck] = await Promise.all([
    supabase.from("admins").select("id").eq("user_id", userId).maybeSingle(),
    supabase
      .from("superadmins")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  return Boolean(adminCheck.data || superAdminCheck.data);
}

export async function GET(request) {
  try {
    const { user } = await requireAuthedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = serviceRoleClient();
    const isAllowed = await requireAdminOrSuperadmin(supabase, user.id);
    if (!isAllowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "pending";
    const q = (searchParams.get("q") || "").trim();
    const limit = Math.min(Number(searchParams.get("limit") || 50), 200);

    let query = supabase
      .from("manual_topup_requests")
      .select(
        "id, user_id, plan_id, plan_name, credits, amount, currency, reference_code, status, notes, created_at, approved_at, approved_by"
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    if (q) {
      // Reference-code search (supports partial matches)
      query = query.ilike("reference_code", `%${q}%`);
    }

    const { data: requests, error } = await query;
    if (error) {
      console.error("Manual topups list error:", error);
      return NextResponse.json(
        { error: "Failed to load requests" },
        { status: 500 }
      );
    }

    // Fetch student info for display
    const userIds = Array.from(new Set((requests || []).map((r) => r.user_id)));
    let studentsByUserId = {};
    if (userIds.length > 0) {
      const { data: students } = await supabase
        .from("Students")
        .select("user_id, email, first_name, last_name")
        .in("user_id", userIds);
      studentsByUserId = (students || []).reduce((acc, s) => {
        acc[s.user_id] = s;
        return acc;
      }, {});
    }

    const hydrated = (requests || []).map((r) => {
      const s = studentsByUserId[r.user_id];
      const name =
        s && (s.first_name || s.last_name)
          ? `${s.first_name || ""} ${s.last_name || ""}`.trim()
          : null;
      return {
        ...r,
        student: s
          ? { email: s.email || null, name: name || s.email || null }
          : null,
      };
    });

    return NextResponse.json({ success: true, requests: hydrated });
  } catch (error) {
    console.error("Manual topups list error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

