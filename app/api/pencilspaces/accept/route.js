import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createPencilSpace } from "@/lib/pencilSpaces";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getSupabaseClient() {
  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured");
  }

  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY (or anon key fallback) is required for Pencil Spaces integration"
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function extractBearerToken(request) {
  const header =
    request.headers.get("authorization") ||
    request.headers.get("Authorization");
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer") return null;
  return token?.trim() || null;
}

async function getAuthenticatedUser(request, supabase) {
  const token = extractBearerToken(request);
  if (!token) {
    return null;
  }
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return null;
  }
  return data.user;
}

async function fetchTutorRecord(supabase, identifier) {
  if (!identifier) return null;
  const { data } = await supabase
    .from("Tutors")
    .select("id, user_id, name, email")
    .eq("id", identifier)
    .maybeSingle();
  if (data) return data;
  const { data: byUser } = await supabase
    .from("Tutors")
    .select("id, user_id, name, email")
    .eq("user_id", identifier)
    .maybeSingle();
  return byUser;
}

async function fetchStudentRecord(supabase, identifier) {
  if (!identifier) return null;
  const { data } = await supabase
    .from("Students")
    .select(
      "id, user_id, name, first_name, last_name, email, profile_name"
    )
    .eq("id", identifier)
    .maybeSingle();
  if (data) return data;
  const { data: byUser } = await supabase
    .from("Students")
    .select(
      "id, user_id, name, first_name, last_name, email, profile_name"
    )
    .eq("user_id", identifier)
    .maybeSingle();
  return byUser;
}

async function fetchAuthUserProfile(supabase, userId) {
  if (!userId) return {};
  try {
    const { data } = await supabase.auth.admin.getUserById(userId);
    if (!data?.user) return {};
    return {
      email: data.user.email,
      name:
        data.user.user_metadata?.full_name ||
        data.user.user_metadata?.name ||
        data.user.email,
    };
  } catch (error) {
    console.warn("Failed to load auth profile", error.message);
    return {};
  }
}

function buildDisplayName(record, fallbackProfile) {
  if (!record) return fallbackProfile || "Participant";
  const fullName =
    record.name ||
    [record.first_name, record.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();
  return (
    fullName ||
    record.profile_name ||
    fallbackProfile ||
    "Participant"
  );
}

function serializePencilMetadata({
  space,
  hostUserId,
  participantUserId,
}) {
  // Persist Pencil Spaces details inside the existing meeting_link column so legacy
  // rows (plain URLs) continue to work while new rows store structured metadata.
  return JSON.stringify({
    type: "pencil-space",
    spaceId: space?.spaceId,
    spaceUrl: space?.link,
    hostUserId,
    participantUserId,
    title: space?.title,
    visibility: space?.visibility,
    updatedAt: new Date().toISOString(),
    metadataVersion: 1,
  });
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const scheduleId = body?.scheduleId;
    if (!scheduleId) {
      return NextResponse.json(
        { error: "scheduleId is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();
    const authedUser = await getAuthenticatedUser(request, supabase);

    if (!authedUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: schedule, error: scheduleError } = await supabase
      .from("Schedules")
      .select(
        "id, tutor_id, student_id, subject, status, meeting_link, start_time_utc, end_time_utc"
      )
      .eq("id", scheduleId)
      .single();

    if (scheduleError || !schedule) {
      return NextResponse.json(
        { error: "Schedule not found" },
        { status: 404 }
      );
    }

    if (schedule.status !== "pending") {
      return NextResponse.json(
        { error: "Only pending schedules can be accepted" },
        { status: 400 }
      );
    }

    const tutorRecord = await fetchTutorRecord(supabase, schedule.tutor_id);
    const tutorSupabaseId =
      tutorRecord?.user_id || schedule.tutor_id;

    if (tutorSupabaseId !== authedUser.id) {
      return NextResponse.json(
        { error: "You are not allowed to accept this booking" },
        { status: 403 }
      );
    }

    const studentRecord = await fetchStudentRecord(
      supabase,
      schedule.student_id
    );

    const spaceTitle =
      schedule.subject ||
      `Tutoring Session`;

    const pencilSpace = await createPencilSpace({
      title: spaceTitle,
      visibility: "public",
    });

    if (!pencilSpace?.link) {
      throw new Error("Pencil Spaces did not return a Space link");
    }

    const { data: updatedSchedule, error: updateError } = await supabase
      .from("Schedules")
      .update({
        status: "confirmed",
        // Store plain Space URL so both parties can join via link
        meeting_link: pencilSpace.link,
      })
      .eq("id", scheduleId)
      .select(
        "id, status, meeting_link, tutor_id, student_id, subject"
      )
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update booking with Pencil Space link" },
        { status: 500 }
      );
    }

    // Send session response notification (accepted)
    try {
      const { notifySessionResponse } = await import('@/lib/notificationService');
      
      const sessionDate = new Date(schedule.start_time_utc).toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      const sessionTime = new Date(schedule.start_time_utc).toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
      
      const tutorEmail =
        tutorRecord?.email || authedUser?.email || null;
      const tutorName =
        tutorRecord?.name ||
        authedUser?.user_metadata?.full_name ||
        authedUser?.user_metadata?.name ||
        "Tutor";
      const studentEmail =
        studentRecord?.email || null;
      const studentName =
        studentRecord?.name ||
        studentRecord?.profile_name ||
        "Student";

      if (tutorEmail && studentEmail) {
        await notifySessionResponse(
          tutorEmail,
          tutorName,
          studentEmail,
          studentName,
          sessionDate,
          sessionTime,
          schedule.subject || 'General Session',
          'accepted'
        );
        console.log('Session acceptance notification sent');
      }
    } catch (notifError) {
      console.error('Failed to send session acceptance notification:', notifError);
      // Don't fail the accept if notification fails
    }

    return NextResponse.json({
      schedule: updatedSchedule,
      pencilSpace: {
        link: pencilSpace?.link,
      },
    });
  } catch (error) {
    console.error("Pencil Spaces accept failure:", error);
    return NextResponse.json(
      { error: error.message || "Failed to accept booking" },
      { status: error.status || 500 }
    );
  }
}


