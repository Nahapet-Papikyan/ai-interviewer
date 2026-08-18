import { NextRequest, NextResponse } from "next/server";
import { interviewLog } from "@/lib/interview/logging";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!rateLimit("interview:trace", 240, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const interviewId = typeof body?.interviewId === "string" ? body.interviewId : "";
  const events = Array.isArray(body?.events) ? body.events : [];
  if (!interviewId || events.length === 0) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  for (const item of events.slice(0, 80)) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const event = typeof rec.event === "string" ? rec.event : "CLIENT_TRACE";
    const clientTs = rec.ts;
    const fields = { ...rec };
    delete fields.event;
    delete fields.ts;
    interviewLog(event, {
      source: "client",
      interviewId,
      clientTs: typeof clientTs === "string" ? clientTs : undefined,
      ...fields,
    });
  }

  return NextResponse.json({ ok: true, n: Math.min(events.length, 80) });
}
