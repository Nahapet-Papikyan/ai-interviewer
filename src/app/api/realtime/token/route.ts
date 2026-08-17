import { NextRequest, NextResponse } from "next/server";
import { InterviewStatus } from "@prisma/client";
import { buildInterviewerInstructions } from "@/lib/interview/context";
import { canTransition } from "@/lib/interview/status";
import { findInterviewByToken, recordEvent, setStatus } from "@/lib/interview/session";
import { mintRealtimeClientSecret } from "@/lib/openai/realtime";
import { rateLimit } from "@/lib/rate-limit";
import { INTERVIEWER_PROMPT_VERSION } from "@/lib/versions";

function clientKey(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export async function POST(request: NextRequest) {
  if (!rateLimit(`realtime:${clientKey(request)}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const interviewToken = typeof body?.interviewToken === "string" ? body.interviewToken : "";
  if (!interviewToken) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const interview = await findInterviewByToken(interviewToken);
  if (!interview) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (["COMPLETED", "ANALYZING", "ANALYZED", "REVIEWED", "FOLLOW_UP_READY"].includes(interview.status)) {
    return NextResponse.json({ error: "Interview already finished" }, { status: 409 });
  }

  const nextStatus =
    interview.status === InterviewStatus.CONSENTED || interview.status === InterviewStatus.OPENED
      ? InterviewStatus.STARTED
      : interview.status === InterviewStatus.INVITED
        ? InterviewStatus.STARTED
        : InterviewStatus.IN_PROGRESS;

  if (canTransition(interview.status, nextStatus)) {
    await setStatus(interview.id, nextStatus, {
      startedAt: interview.startedAt ?? new Date(),
    });
  }

  await recordEvent(interview.id, "session_started");

  const instructions = buildInterviewerInstructions({
    respondentName: interview.contact.firstName,
    respondentRole: interview.contact.role,
    preferredLanguage: interview.contact.preferredLanguage,
    companyName: interview.company.name,
    vertical: interview.company.vertical,
    verifiedFacts: asStringArray(interview.company.verifiedFacts),
    hypotheses: asStringArray(interview.company.hypotheses),
  });

  const clientSecret = await mintRealtimeClientSecret({
    instructions,
    model: process.env.OPENAI_REALTIME_MODEL ?? "gpt-realtime-2.1",
  });

  return NextResponse.json({
    clientSecret,
    instructions,
    model: process.env.OPENAI_REALTIME_MODEL ?? "gpt-realtime-2.1",
    promptVersion: INTERVIEWER_PROMPT_VERSION,
    interview: {
      id: interview.id,
      status: nextStatus,
      language: interview.language,
      respondentFirstName: interview.contact.firstName,
      respondentRole: interview.contact.role,
      companyName: interview.company.name,
    },
  });
}
