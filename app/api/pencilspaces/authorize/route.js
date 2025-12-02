import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authorizePencilUser, buildDefaultRedirectUrl } from "@/lib/pencilSpaces";
import { parseMeetingLink } from "@/lib/meetingLinks";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getSupabaseClient() {
  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured");
  }
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");
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

async function fetchStudentRecord(supabase, identifier) {
  if (!identifier) return null;
  const { data } = await supabase
    .from("Students")
    .select("id, user_id")
    .eq("id", identifier)
    .maybeSingle();
  if (data) return data;
  const { data: byUser } = await supabase
    .from("Students")
    .select("id, user_id")
    .eq("user_id", identifier)
    .maybeSingle();
  return byUser;
}

async function fetchTutorRecord(supabase, identifier) {
  if (!identifier) return null;
  const { data } = await supabase
    .from("Tutors")
    .select("id, user_id")
    .eq("id", identifier)
    .maybeSingle();
  if (data) return data;
  const { data: byUser } = await supabase
    .from("Tutors")
    .select("id, user_id")
    .eq("user_id", identifier)
    .maybeSingle();
  return byUser;
}

function extractLegacyLink(parsedLink, schedule) {
  if (parsedLink.kind === "legacy-url" && parsedLink.url) {
    return parsedLink.url;
  }

  if (parsedLink.kind === "empty" && schedule?.meeting_link) {
    return schedule.meeting_link;
  }

  return null;
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
        "id, tutor_id, student_id, meeting_link, status"
      )
      .eq("id", scheduleId)
      .single();

    if (scheduleError || !schedule) {
      return NextResponse.json(
        { error: "Schedule not found" },
        { status: 404 }
      );
    }

    const parsedLink = parseMeetingLink(schedule.meeting_link);
    const legacyLink = extractLegacyLink(parsedLink, schedule);

    if (legacyLink) {
      return NextResponse.json({ url: legacyLink });
    }

    if (parsedLink.kind !== "pencil-space") {
      return NextResponse.json(
        { error: "This meeting does not have a Pencil Space assigned yet." },
        { status: 409 }
      );
    }

    const pencilData = parsedLink.data;
    const tutorRecord = await fetchTutorRecord(supabase, schedule.tutor_id);
    const studentRecord = await fetchStudentRecord(
      supabase,
      schedule.student_id
    );

    const tutorSupabaseId = tutorRecord?.user_id || schedule.tutor_id;
    const studentSupabaseId =
      studentRecord?.user_id || schedule.student_id;

    let pencilUserId = null;

    if (authedUser.id === tutorSupabaseId) {
      pencilUserId = pencilData.hostUserId;
    } else if (authedUser.id === studentSupabaseId) {
      pencilUserId = pencilData.participantUserId;
    } else {
      return NextResponse.json(
        { error: "You are not part of this meeting" },
        { status: 403 }
      );
    }

    if (!pencilUserId) {
      return NextResponse.json(
        { error: "Missing Pencil Spaces user mapping" },
        { status: 422 }
      );
    }

    const redirectUrl = buildDefaultRedirectUrl({
      spaceId: pencilData.spaceId,
      spaceUrl: pencilData.spaceUrl,
    });

    const authorizeResponse = await authorizePencilUser({
      pencilUserId,
      redirectUrl,
    });

    const joinUrl = authorizeResponse?.url || authorizeResponse?.link;
    if (!joinUrl) {
      return NextResponse.json(
        { error: "Pencil Spaces did not return an authorization URL" },
        { status: 502 }
      );
    }

    return NextResponse.json({ url: joinUrl });
  } catch (error) {
    console.error("Pencil Spaces authorize failure:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate join link" },
      { status: error.status || 500 }
    );
  }
}



