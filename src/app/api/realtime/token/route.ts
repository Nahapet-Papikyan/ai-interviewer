import { NextRequest, NextResponse } from "next/server";
import { InterviewStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { buildInterviewerInstructions, interviewerPromptMeta } from "@/lib/interview/context";
import { interviewLog } from "@/lib/interview/logging";
import { restoreWindow } from "@/lib/interview/messages";
import { hydrateRuntimeState, shouldConnectRealtime } from "@/lib/interview/runtime-state";
import { canTransition } from "@/lib/interview/status";
import { findInterviewByToken, recordEvent, saveRuntimeState, setStatus } from "@/lib/interview/session";
import { mintRealtimeClientSecret } from "@/lib/openai/realtime";
import {
  REALTIME_TRANSCRIBE_LANGUAGE,
  REALTIME_TRANSCRIBE_PROMPT,
  realtimeModel,
  realtimeVoice,
} from "@/lib/openai/realtime-config";
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

  if (!shouldConnectRealtime(interview.status)) {
    return NextResponse.json({ error: "Interview already finished" }, { status: 409 });
  }

  const messages = await prisma.interviewMessage.findMany({
    where: { interviewId: interview.id },
    orderBy: { sequenceNo: "asc" },
    select: { role: true, contentText: true, sequenceNo: true, providerEventId: true },
  });
  const runtimeState = hydrateRuntimeState(interview.state, messages);
  const isReconnect = runtimeState.openingDelivered || messages.length > 0;
  runtimeState.connectionGeneration += 1;

  const nextStatus =
    interview.status === InterviewStatus.CONSENTED || interview.status === InterviewStatus.OPENED
      ? InterviewStatus.STARTED
      : interview.status === InterviewStatus.INVITED
        ? InterviewStatus.STARTED
        : InterviewStatus.IN_PROGRESS;

  if (canTransition(interview.status, nextStatus) && interview.status !== nextStatus) {
    await setStatus(interview.id, nextStatus, {
      startedAt: interview.startedAt ?? new Date(),
      promptVersion: INTERVIEWER_PROMPT_VERSION,
    });
  } else if (interview.promptVersion !== INTERVIEWER_PROMPT_VERSION) {
    await prisma.interview.update({
      where: { id: interview.id },
      data: { promptVersion: INTERVIEWER_PROMPT_VERSION },
    });
  }

  await saveRuntimeState(interview.id, {
    interviewStarted: true,
    connectionGeneration: runtimeState.connectionGeneration,
    openingDelivered: runtimeState.openingDelivered,
    consentReceived: runtimeState.consentReceived,
    phase: runtimeState.phase,
    completed: runtimeState.completed,
    activeProcess: runtimeState.activeProcess,
  });

  const instructions = buildInterviewerInstructions({
    respondentName: interview.contact.firstName,
    respondentRole: interview.contact.role,
    preferredLanguage: interview.contact.preferredLanguage,
    companyName: interview.company.name,
    vertical: interview.company.vertical,
    verifiedFacts: asStringArray(interview.company.verifiedFacts),
    hypotheses: asStringArray(interview.company.hypotheses),
    respondentNameHy: interview.contact.firstName,
    runtimeState,
  });
  const prompt = interviewerPromptMeta();

  const model = realtimeModel();
  const voice = realtimeVoice();
  const clientSecret = await mintRealtimeClientSecret({
    instructions,
    model,
    voice,
    createResponse: false,
    transcribeLanguage: REALTIME_TRANSCRIBE_LANGUAGE,
    transcribePrompt: REALTIME_TRANSCRIBE_PROMPT,
  });

  await recordEvent(interview.id, isReconnect ? "realtime_reconnected" : "realtime_connected", {
    promptVersion: prompt.version,
    promptHash: prompt.hash,
    connectionGeneration: runtimeState.connectionGeneration,
  });

  interviewLog(isReconnect ? "REALTIME_RECONNECTED" : "REALTIME_CONNECTED", {
    interviewId: interview.id,
    promptVersion: prompt.version,
    promptSource: prompt.source,
    promptHash: prompt.hash,
    connectionGeneration: runtimeState.connectionGeneration,
    openingDelivered: runtimeState.openingDelivered,
    phase: runtimeState.phase,
  });

  return NextResponse.json({
    clientSecret,
    instructions,
    model,
    voice,
    promptVersion: prompt.version,
    promptSource: prompt.source,
    promptHash: prompt.hash,
    interviewId: interview.id,
    continuation: isReconnect,
    runtimeState,
    recentTurns: restoreWindow(
      messages
        .filter((message) => message.role === "user" || message.role === "assistant")
        .map((message) => ({
          role: message.role as "user" | "assistant",
          content: message.contentText,
          providerEventId: message.providerEventId,
        })),
    ),
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
