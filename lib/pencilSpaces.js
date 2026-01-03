// Pencil Spaces API base URLs - from their documentation
// Production: https://apis.pencilapp.com/public/api/
// Staging: https://staging-apis.pencilapp.com/public/api/
// Note: Requires usage-based or Enterprise account
const API_BASE_URL =
  process.env.PENCIL_SPACES_API_BASE_URL ||
  process.env.PENCIL_SPACES_API_URL ||
  (process.env.NODE_ENV === "production"
    ? "https://apis.pencilapp.com/public/api"
    : "https://staging-apis.pencilapp.com/public/api");

function ensureApiKey() {
  const apiKey = process.env.NEXT_PUBLIC_PENCIL_SPACE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_PENCIL_SPACE_API_KEY. Please add it to your environment."
    );
  }
  return apiKey;
}

async function pencilSpacesRequest(path, { method = "GET", body } = {}) {
  const apiKey = ensureApiKey();
  // Ensure path starts with / and add version prefix if needed
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${API_BASE_URL}${normalizedPath}`;

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const rawText = await response.text();
  let payload = null;
  try {
    payload = rawText ? JSON.parse(rawText) : null;
  } catch {
    payload = rawText;
  }

  if (!response.ok) {
    // Log full error details for debugging
    console.error("Pencil Spaces API Error:", {
      url,
      method,
      status: response.status,
      statusText: response.statusText,
      payload,
      rawText,
      headers: Object.fromEntries(response.headers.entries()),
    });
    
    // Check for Firebase-related errors from Pencil Spaces backend
    if (payload?.err?.includes("Firebase") || rawText?.includes("Firebase")) {
      console.warn(
        "Pencil Spaces API returned a Firebase error. This may indicate:",
        "1. Pencil Spaces backend uses Firebase internally",
        "2. The API key format or permissions may be incorrect",
        "3. Contact Pencil Spaces support about this error"
      );
    }
    
    const message =
      payload?.message ||
      payload?.error ||
      payload?.err ||
      rawText ||
      `Pencil Spaces API request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.details = payload;
    error.url = url;
    throw error;
  }

  return payload;
}

// Test API connectivity by trying to list users
export async function testPencilSpacesConnection() {
  try {
    const response = await pencilSpacesRequest("/users", {
      method: "GET",
    });
    return { success: true, message: "API connection successful" };
  } catch (error) {
    return {
      success: false,
      message: error.message,
      status: error.status,
      url: error.url,
    };
  }
}

// Get user by email to check if they already exist
export async function getPencilUserByEmail(email) {
  if (!email) {
    return null;
  }
  try {
    // Try to get users filtered by email
    const response = await pencilSpacesRequest("/users", {
      method: "GET",
    });
    // Filter the response to find user by email
    if (Array.isArray(response)) {
      return response.find((u) => u.email === email);
    }
    if (response?.results && Array.isArray(response.results)) {
      return response.results.find((u) => u.email === email);
    }
    return null;
  } catch (error) {
    // If user not found, that's okay - we'll create them
    if (error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function createPencilApiUser({
  name,
  email,
  role = "Student",
  externalId,
}) {
  if (!email) {
    throw new Error("Pencil Spaces user creation requires an email.");
  }

  // First, check if user already exists
  const existingUser = await getPencilUserByEmail(email).catch(() => null);
  if (existingUser?.userId) {
    return existingUser;
  }

  const payload = {
    name: name?.trim() || email,
    email,
    userRole: role,
    // Note: externalId removed - Pencil Spaces may interpret Supabase IDs as Firebase tokens
    // If you need external ID mapping, contact Pencil Spaces support for the correct format
  };

  try {
    return await pencilSpacesRequest("/users/createAPIUser", {
      method: "POST",
      body: payload,
    });
  } catch (error) {
    // If the endpoint doesn't exist, provide helpful error message
    if (
      error.message?.includes("not found") ||
      error.status === 404 ||
      error.message?.includes("Route")
    ) {
      const helpfulMessage = `Pencil Spaces API endpoint not found. This usually means:
1. Your API key may not have permission to create users
2. Your account type may not support API user creation
3. The endpoint may require additional setup in your Pencil Spaces dashboard

Please contact Pencil Spaces support at https://pencilspaces.com/support with:
- Your API key (first few characters only for security)
- The error message: "${error.message}"
- Request access to the /users/createAPIUser endpoint

API Base URL: ${API_BASE_URL}
Endpoint: /users/createAPIUser
Full URL: ${error.url || `${API_BASE_URL}/users/createAPIUser`}`;

      const enhancedError = new Error(helpfulMessage);
      enhancedError.status = error.status;
      enhancedError.details = error.details;
      enhancedError.url = error.url;
      throw enhancedError;
    }
    throw error;
  }
}

export async function createPencilSpace({
  title,
  hostUserId,
  participantUserId,
  visibility = "private",
}) {
  if (!hostUserId || !participantUserId) {
    throw new Error("Pencil Spaces createSpace requires host and participant.");
  }

  const body = {
    title: title || "Tutoring Session",
    visibility,
    hosts: [{ userId: hostUserId }],
    participants: [{ userId: participantUserId }],
    settings: {
      enableWaitingRoom: false,
    },
  };

  return pencilSpacesRequest("/spaces/create", {
    method: "POST",
    body,
  });
}

export async function authorizePencilUser({ pencilUserId, redirectUrl }) {
  if (!pencilUserId) {
    throw new Error("authorizePencilUser requires pencilUserId");
  }

  const params = new URLSearchParams();
  if (redirectUrl) {
    params.set("redirectUrl", redirectUrl);
  }
  const query = params.toString();
  const path = `/users/${pencilUserId}/authorize${
    query ? `?${query}` : ""
  }`;

  return pencilSpacesRequest(path, { method: "GET" });
}

export function buildDefaultRedirectUrl({ spaceId, spaceUrl }) {
  if (spaceUrl) return spaceUrl;
  if (!spaceId) return null;
  const url = new URL(`https://my.pencilapp.com/spaces/${spaceId}`);
  url.searchParams.set("standalone", "true");
  url.searchParams.set("startCall", "true");
  url.searchParams.set("gv", "true");
  return url.toString();
}



