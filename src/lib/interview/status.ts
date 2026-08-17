import { InterviewStatus } from "@prisma/client";

const ALLOWED: Record<InterviewStatus, InterviewStatus[]> = {
  INVITED: ["OPENED", "ABANDONED", "FAILED"],
  OPENED: ["CONSENTED", "ABANDONED", "FAILED"],
  CONSENTED: ["STARTED", "ABANDONED", "FAILED"],
  STARTED: ["IN_PROGRESS", "ABANDONED", "FAILED", "COMPLETED"],
  IN_PROGRESS: ["COMPLETED", "ABANDONED", "FAILED"],
  COMPLETED: ["ANALYZING", "FAILED"],
  ABANDONED: ["OPENED", "CONSENTED", "STARTED", "IN_PROGRESS", "ANALYZING", "FAILED"],
  FAILED: ["OPENED", "STARTED", "IN_PROGRESS", "ANALYZING"],
  ANALYZING: ["ANALYZED", "FAILED"],
  ANALYZED: ["REVIEWED", "FOLLOW_UP_READY", "ANALYZING"],
  REVIEWED: ["FOLLOW_UP_READY", "ANALYZING"],
  FOLLOW_UP_READY: ["REVIEWED"],
};

export function canTransition(from: InterviewStatus, to: InterviewStatus) {
  if (from === to) return true;
  return ALLOWED[from]?.includes(to) ?? false;
}
