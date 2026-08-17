import { NextRequest, NextResponse } from "next/server";
import { requireIngestApiKey } from "@/lib/ingest-auth";
import { invitationSchema, issueInterviewInvitation } from "@/lib/interview/invitation-api";
import { rateLimit } from "@/lib/rate-limit";

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Authorization, Content-Type, X-API-Key",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}

export async function POST(request: NextRequest) {
  const auth = requireIngestApiKey(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!rateLimit("ingest:invitations", 40, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const parsed = invitationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const created = await issueInterviewInvitation(parsed.data, request.nextUrl.origin);
  return NextResponse.json(created);
}
