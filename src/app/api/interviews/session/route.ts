import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { InterviewStatus, MessageRole, MessageSource } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { findInterviewByToken, recordEvent, setStatus } from "@/lib/interview/session";
import { runInterviewAnalysis } from "@/lib/openai/analyzer";
import { after } from "next/server";

type HistoryTurn = {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
};

const transcriptLocks = new Map<string, Promise<unknown>>();

function withInterviewLock<T>(interviewId: string, fn: () => Promise<T>): Promise<T> {
  const previous = transcriptLocks.get(interviewId) ?? Promise.resolve();
  const run = previous.then(fn, fn);
  transcriptLocks.set(
    interviewId,
    run.then(
      () => undefined,
      () => undefined,
    ),
  );
  return run;
}

function normalizeTurns(turns: HistoryTurn[]) {
  const cleaned: HistoryTurn[] = [];
  for (const turn of turns) {
    const content = turn.content.trim();
    if (!content) continue;
    const last = cleaned[cleaned.length - 1];
    if (last && last.role === turn.role && last.content === content) continue;
    cleaned.push({ role: turn.role, content });
  }
  return cleaned;
}

async function replaceTranscript(interviewId: string, turns: HistoryTurn[], source: MessageSource) {
  const normalized = normalizeTurns(turns);
  if (normalized.length === 0) return;
  await withInterviewLock(interviewId, () =>
    prisma.$transaction(async (tx) => {
      const existingCount = await tx.interviewMessage.count({ where: { interviewId } });
      if (normalized.length < existingCount) return;
      await tx.processEvidence.updateMany({
        where: { process: { interviewId } },
        data: { messageId: null },
      });
      await tx.interviewMessage.deleteMany({ where: { interviewId } });
      await tx.interviewMessage.createMany({
        skipDuplicates: true,
        data: normalized.map((turn, index) => ({
          interviewId,
          sequenceNo: index + 1,
          role: turn.role as MessageRole,
          contentText: turn.content,
          source,
        })),
      });
    }),
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const interviewToken = typeof body?.interviewToken === "string" ? body.interviewToken : "";
  const action = typeof body?.action === "string" ? body.action : "";
  if (!interviewToken || !action) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const interview = await findInterviewByToken(interviewToken);
  if (!interview) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (action === "consent") {
    await setStatus(interview.id, InterviewStatus.CONSENTED, { consentedAt: new Date() });
    await recordEvent(interview.id, "consent_accepted");
    return NextResponse.json({ ok: true, status: InterviewStatus.CONSENTED });
  }

  if (action === "history") {
    const turns = Array.isArray(body.turns) ? (body.turns as HistoryTurn[]) : [];
    const source = body.source === "manual" ? MessageSource.manual : MessageSource.realtime;
    await replaceTranscript(interview.id, turns, source);
    if (interview.status === InterviewStatus.STARTED) {
      await setStatus(interview.id, InterviewStatus.IN_PROGRESS);
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "fact") {
    await prisma.interviewFact.create({
      data: {
        interviewId: interview.id,
        category: String(body.category ?? "unknown"),
        value: String(body.value ?? ""),
        processName: body.processName ? String(body.processName) : null,
        evidenceSummary: body.evidenceSummary ? String(body.evidenceSummary) : null,
      },
    });
    await recordEvent(interview.id, "tool_call", { tool: "record_key_fact" });
    return NextResponse.json({ ok: true });
  }

  if (action === "process") {
    const state = (interview.state as { candidateProcesses?: unknown[] } | null) ?? {};
    const candidates = Array.isArray(state.candidateProcesses) ? state.candidateProcesses : [];
    candidates.push({
      name: String(body.name ?? ""),
      shortReason: String(body.shortReason ?? ""),
    });
    await prisma.interview.update({
      where: { id: interview.id },
      data: { state: { ...state, candidateProcesses: candidates } as Prisma.InputJsonValue },
    });
    await recordEvent(interview.id, "tool_call", { tool: "record_process_candidate" });
    return NextResponse.json({ ok: true });
  }

  if (action === "text") {
    const content = String(body.content ?? "").trim();
    if (!content) return NextResponse.json({ error: "Empty" }, { status: 400 });
    const last = await prisma.interviewMessage.findFirst({
      where: { interviewId: interview.id },
      orderBy: { sequenceNo: "desc" },
    });
    await prisma.interviewMessage.create({
      data: {
        interviewId: interview.id,
        sequenceNo: (last?.sequenceNo ?? 0) + 1,
        role: MessageRole.user,
        contentText: content,
        source: MessageSource.manual,
      },
    });
    await recordEvent(interview.id, "respondent_turn", { source: "manual" });
    return NextResponse.json({ ok: true });
  }

  if (action === "abandon") {
    await setStatus(interview.id, InterviewStatus.ABANDONED);
    await recordEvent(interview.id, "session_ended", { reason: "abandoned" });
    return NextResponse.json({ ok: true });
  }

  if (action === "complete") {
    const turns = Array.isArray(body.turns) ? (body.turns as HistoryTurn[]) : [];
    if (turns.length) {
      await replaceTranscript(
        interview.id,
        turns,
        body.source === "manual" ? MessageSource.manual : MessageSource.realtime,
      );
    }
    const startedAt = interview.startedAt ?? interview.createdAt;
    const durationSeconds = Math.max(0, Math.round((Date.now() - startedAt.getTime()) / 1000));
    await setStatus(interview.id, InterviewStatus.COMPLETED, {
      completedAt: new Date(),
      durationSeconds,
    });
    await recordEvent(interview.id, "session_ended", { reason: "completed" });
    after(() =>
      runInterviewAnalysis(interview.id).catch((error) => {
        console.error("analysis failed", error);
      }),
    );
    return NextResponse.json({ ok: true, status: InterviewStatus.COMPLETED });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
