import { prisma } from "@/lib/db/prisma";
import { hashToken } from "@/lib/tokens";
import {
  hydrateRuntimeState,
  mergeRuntimeState,
  parseRuntimeState,
  type InterviewRuntimeState,
} from "@/lib/interview/runtime-state";
import { InterviewStatus, Prisma } from "@prisma/client";

export async function findInterviewByToken(token: string) {
  const publicTokenHash = hashToken(token);
  return prisma.interview.findUnique({
    where: { publicTokenHash },
    include: {
      company: true,
      contact: true,
    },
  });
}

export async function recordEvent(
  interviewId: string,
  type: string,
  payload?: unknown,
) {
  await prisma.interviewEvent.create({
    data: {
      interviewId,
      type,
      payload: payload === undefined ? undefined : (payload as object),
    },
  });
}

export async function setStatus(interviewId: string, status: InterviewStatus, extra: Record<string, unknown> = {}) {
  return prisma.interview.update({
    where: { id: interviewId },
    data: { status, ...extra },
  });
}

export async function loadRuntimeState(interviewId: string): Promise<InterviewRuntimeState> {
  const interview = await prisma.interview.findUnique({
    where: { id: interviewId },
    select: {
      state: true,
      status: true,
      messages: { select: { role: true, contentText: true }, orderBy: { sequenceNo: "asc" } },
    },
  });
  if (!interview) return hydrateRuntimeState(null);
  const state = hydrateRuntimeState(interview.state, interview.messages);
  if (["COMPLETED", "ANALYZING", "ANALYZED", "REVIEWED", "FOLLOW_UP_READY"].includes(interview.status)) {
    state.completed = true;
    state.phase = "COMPLETED";
  }
  return state;
}

export async function saveRuntimeState(
  interviewId: string,
  patch: Partial<InterviewRuntimeState>,
  options?: { bumpRevision?: boolean },
): Promise<InterviewRuntimeState> {
  const interview = await prisma.interview.findUnique({
    where: { id: interviewId },
    select: { state: true },
  });
  const current = parseRuntimeState(interview?.state);
  const next = mergeRuntimeState(current, patch);
  if (options?.bumpRevision) {
    next.stateRevision = current.stateRevision + 1;
  }
  await prisma.interview.update({
    where: { id: interviewId },
    data: { state: next as Prisma.InputJsonValue },
  });
  return next;
}
