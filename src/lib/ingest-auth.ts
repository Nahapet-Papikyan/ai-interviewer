export function requireIngestApiKey(request: Request) {
  const configured = process.env.INGEST_API_KEY?.trim();
  if (!configured) {
    return { ok: false as const, status: 503, error: "Invite API is not configured" };
  }

  const header = request.headers.get("authorization") ?? "";
  const bearer = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  const apiKey = request.headers.get("x-api-key")?.trim() || bearer;

  if (!apiKey || apiKey !== configured) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }

  return { ok: true as const };
}
