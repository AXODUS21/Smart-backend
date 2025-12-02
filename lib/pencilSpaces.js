const API_BASE_URL =
  process.env.PENCIL_SPACES_API_BASE_URL ||
  "https://api.pencilspaces.com/v1";

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
    });
    
    const message =
      payload?.message ||
      payload?.error ||
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

export async function createPencilApiUser({
  name,
  email,
  role = "Student",
  externalId,
}) {
  if (!email) {
    throw new Error("Pencil Spaces user creation requires an email.");
  }

  const payload = {
    name: name?.trim() || email,
    email,
    userRole: role,
    ...(externalId ? { externalId } : {}),
  };

  return pencilSpacesRequest("/users/createAPIUser", {
    method: "POST",
    body: payload,
  });
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



