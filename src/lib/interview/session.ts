import { prisma } from "@/lib/db/prisma";
import { hashToken } from "@/lib/tokens";
import { InterviewStatus } from "@prisma/client";

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
