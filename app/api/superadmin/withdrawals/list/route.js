import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getServiceClient() {
  if (!supabaseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured");
  if (!serviceRoleKey) throw new Error("Missing Supabase key for service client");
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function getAnonAuthClient() {
  if (!supabaseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is required");
  return createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
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

async function requireAuthedUser(request) {
  const token = extractBearerToken(request);
  if (!token) return null;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) {
    // Misconfigured deployment; surface as 500 in caller
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured on server");
  }

  // Try both Supabase JS patterns for maximum compatibility across runtimes.
  // 1) Header-based getUser() (recommended for v2 in server routes)
  const headerClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const headerRes = await headerClient.auth.getUser();
  if (headerRes?.data?.user) return headerRes.data.user;

  // 2) Token-argument getUser(token) fallback (some bundles still support it)
  const tokenClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  // @ts-ignore - support older signature
  const tokenRes = await tokenClient.auth.getUser(token);
  if (tokenRes?.data?.user) return tokenRes.data.user;

  return null;
}

export async function GET(request) {
  try {
    const authedUser = await requireAuthedUser(request);
    if (!authedUser) {
      return NextResponse.json(
        { error: "Unauthorized: invalid or expired session token" },
        { status: 401 }
      );
    }

    const supabase = getServiceClient();

    // Only superadmins can list withdrawals
    const { data: superadmin, error: superadminErr } = await supabase
      .from("superadmins")
      .select("id")
      .eq("user_id", authedUser.id)
      .maybeSingle();

    if (superadminErr || !superadmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("TutorWithdrawals")
      .select(
        `
        *,
        tutor:Tutors(
          id,
          first_name,
          last_name,
          email,
          pricing_region,
          payment_method,
          bank_account_name,
          bank_account_number,
          bank_name,
          bank_branch,
          paypal_email,
          gcash_number,
          gcash_name,
          credits
        )
      `
      )
      .order("requested_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ withdrawals: data || [] });
  } catch (e) {
    console.error("Superadmin withdrawals list error:", e);
    return NextResponse.json(
      { error: e?.message || "Failed to load withdrawals" },
      { status: 500 }
    );
  }
}

