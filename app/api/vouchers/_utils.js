import { createClient } from "@supabase/supabase-js";

export function getEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured on server");
  if (!anonKey) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured on server");
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured on server");
  return { supabaseUrl, anonKey, serviceRoleKey };
}

export function getTokenFromRequest(request) {
  const header = request.headers.get("authorization") || request.headers.get("Authorization");
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

export async function requireAuthedUser(request) {
  const { supabaseUrl, anonKey } = getEnv();
  const token = getTokenFromRequest(request);
  if (!token) return { user: null, token: null };

  // Try header-based auth first
  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userRes } = await authClient.auth.getUser();
  if (userRes?.user) return { user: userRes.user, token };

  // Fallback pattern
  const authClient2 = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userRes2 } = await authClient2.auth.getUser(token);
  return { user: userRes2?.user || null, token };
}

export function serviceRoleClient() {
  const { supabaseUrl, serviceRoleKey } = getEnv();
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

