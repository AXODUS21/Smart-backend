export function parseMeetingLink(rawValue) {
  if (!rawValue) {
    return { kind: "empty" };
  }

  if (typeof rawValue !== "string") {
    return { kind: "unknown", raw: rawValue };
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (parsed && parsed.type === "pencil-space" && parsed.spaceId) {
      return { kind: "pencil-space", data: parsed };
    }
  } catch {
    // Not JSON, fall through to legacy handling
  }

  return { kind: "legacy-url", url: rawValue };
}

export function isPencilSpaceLink(parsedResult) {
  return parsedResult?.kind === "pencil-space";
}

