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

export async function POST(request) {
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

    const body = await request.json();
    const { requestId } = body || {};
    if (!requestId) {
      return NextResponse.json(
        { error: "Missing requestId" },
        { status: 400 }
      );
    }

    // Load request (must be pending)
    const { data: reqRow, error: reqErr } = await supabase
      .from("manual_topup_requests")
      .select("id, user_id, credits, status, reference_code")
      .eq("id", requestId)
      .single();

    if (reqErr || !reqRow) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    if (reqRow.status !== "pending") {
      return NextResponse.json(
        { error: `Request is already ${reqRow.status}` },
        { status: 409 }
      );
    }

    // STUDENT-ONLY: ensure user exists in Students table
    const { data: student, error: studentErr } = await supabase
      .from("Students")
      .select("credits")
      .eq("user_id", reqRow.user_id)
      .single();

    if (studentErr || !student) {
      return NextResponse.json(
        { error: "Student account not found for this request" },
        { status: 422 }
      );
    }

    const currentCredits = Number(student.credits || 0);
    const addCredits = Number(reqRow.credits || 0);
    const newCredits = currentCredits + addCredits;

    // Update credits then mark request approved
    const { error: updateCreditsErr } = await supabase
      .from("Students")
      .update({ credits: newCredits })
      .eq("user_id", reqRow.user_id);

    if (updateCreditsErr) {
      console.error("Failed to update student credits:", updateCreditsErr);
      return NextResponse.json(
        { error: "Failed to update student credits" },
        { status: 500 }
      );
    }

    const { error: approveErr } = await supabase
      .from("manual_topup_requests")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", reqRow.id);

    if (approveErr) {
      console.error("Failed to approve request:", approveErr);
      return NextResponse.json(
        {
          error:
            "Credits were updated but request approval failed. Please contact support.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      referenceCode: reqRow.reference_code,
      newCredits,
      addedCredits: addCredits,
    });
  } catch (error) {
    console.error("Manual topup approve error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

