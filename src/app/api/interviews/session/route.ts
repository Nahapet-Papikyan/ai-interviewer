import { NextRequest, NextResponse } from "next/server";
import { FactStatus, InterviewStatus, MessageRole, MessageSource } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { decideRecordKeyFact } from "@/lib/interview/facts";
import { interviewLog } from "@/lib/interview/logging";
import { planTranscriptUpsert, type HistoryTurn } from "@/lib/interview/messages";
import { canTransition } from "@/lib/interview/status";
import {
  findInterviewByToken,
  loadRuntimeState,
  recordEvent,
  saveRuntimeState,
  setStatus,
} from "@/lib/interview/session";
import {
  shouldCompleteInterview,
  type InterviewPhase,
  type InterviewRuntimeState,
} from "@/lib/interview/runtime-state";
import {
  canAskQuestion,
  commitCanonicalFact,
  markQuestionPlanned,
  MAX_CLARIFICATION_ATTEMPTS,
  type CanonicalFact,
} from "@/lib/interview/reasoning-state";
import { planNextQuestion } from "@/lib/interview/question-planner";
import { Prisma } from "@prisma/client";

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

async function upsertTranscript(interviewId: string, turns: HistoryTurn[], source: MessageSource) {
  if (turns.length === 0) return;
  await withInterviewLock(interviewId, () =>
    prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${interviewId}))`;
      const existing = await tx.interviewMessage.findMany({
        where: { interviewId },
        orderBy: { sequenceNo: "asc" },
        select: { sequenceNo: true, role: true, contentText: true, providerEventId: true },
      });
      const plan = planTranscriptUpsert(existing, turns);
      if (plan.type === "skip") return;

      for (const update of plan.updates) {
        await tx.interviewMessage.update({
          where: { interviewId_sequenceNo: { interviewId, sequenceNo: update.sequenceNo } },
          data: {
            contentText: update.contentText,
            providerEventId: update.providerEventId ?? undefined,
          },
        });
      }

      if (plan.inserts.length) {
        await tx.interviewMessage.createMany({
          skipDuplicates: true,
          data: plan.inserts.map((turn, index) => ({
            interviewId,
            sequenceNo: plan.nextSequence + index,
            role: turn.role as MessageRole,
            contentText: turn.content,
            source,
            providerEventId: turn.providerEventId ?? undefined,
          })),
        });
      }
    }),
  );
}

function asHistoryTurns(value: unknown): HistoryTurn[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const rec = item as Record<string, unknown>;
    const role = rec.role;
    const content = typeof rec.content === "string" ? rec.content : "";
    if (role !== "user" && role !== "assistant" && role !== "system" && role !== "tool") return [];
    return [
      {
        role,
        content,
        providerEventId: typeof rec.providerEventId === "string" ? rec.providerEventId : null,
      },
    ];
  });
}

function prismaFactStatus(status: CanonicalFact["status"]): FactStatus {
  if (status === "UNCERTAIN") return FactStatus.UNCERTAIN;
  if (status === "INFERRED") return FactStatus.INFERRED;
  if (status === "CONFLICT") return FactStatus.CONFLICT;
  return FactStatus.CONFIRMED;
}

async function persistCanonicalFact(
  interviewId: string,
  fact: CanonicalFact,
  evidenceSummary: string | null,
  processName: string | null,
) {
  const data = {
    category: fact.category,
    value: fact.value,
    processName,
    evidenceSummary,
    status: prismaFactStatus(fact.status),
    rawTranscript: fact.rawTranscript ?? null,
    sourceRole: "user",
    confidence: fact.confidence ?? (fact.status === "CONFIRMED" ? 1 : 0.4),
    factKey: fact.key,
    processKey: fact.processKey ?? null,
    quantity: (fact.quantity ?? Prisma.JsonNull) as Prisma.InputJsonValue,
    minValue: fact.quantity?.min ?? null,
    maxValue: fact.quantity?.max ?? null,
    unit: fact.quantity?.unit ?? null,
    period: fact.quantity?.period ?? null,
    scope: fact.quantity?.scope ?? null,
    stage: fact.quantity?.stage ?? null,
  };

    const existing = fact.key
    ? await prisma.interviewFact.findFirst({
        where: {
          interviewId,
          factKey: fact.key,
          processKey: fact.processKey ?? null,
        },
      })
    : null;

  if (existing) {
    await prisma.interviewFact.update({
      where: { id: existing.id },
      data,
    });
    return;
  }

  await prisma.interviewFact.create({
    data: {
      interviewId,
      ...data,
    },
  });
}

function finalizeReasoning(state: InterviewRuntimeState) {
  const planned = planNextQuestion(state);
  const next = markQuestionPlanned(state, planned);
  if (
    planned.reason === "CLARIFICATION" &&
    planned.questionKey &&
    (next.questionStates.find((item) => item.key === planned.questionKey)?.clarificationCount ?? 0) >
      MAX_CLARIFICATION_ATTEMPTS
  ) {
    interviewLog("QUESTION_CLARIFICATION_EXHAUSTED", {
      questionKey: planned.questionKey,
      phase: next.phase,
    });
  }
  interviewLog("QUESTION_PLANNED", {
    questionKey: planned.questionKey,
    reason: planned.reason,
    phase: next.phase,
    shouldAsk: planned.shouldAsk,
  });
  return { state: next, nextQuestion: planned };
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

  if (action === "telemetry") {
    const settings =
      body.settings && typeof body.settings === "object" && !Array.isArray(body.settings)
        ? (body.settings as Record<string, unknown>)
        : {};
    await recordEvent(interview.id, "audio_settings", {
      echoCancellation: settings.echoCancellation ?? null,
      noiseSuppression: settings.noiseSuppression ?? null,
      autoGainControl: settings.autoGainControl ?? null,
      sampleRate: settings.sampleRate ?? null,
      channelCount: settings.channelCount ?? null,
      deviceIdHash: typeof settings.deviceIdHash === "string" ? settings.deviceIdHash : null,
      processedMic: Boolean(settings.processedMic),
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "consent") {
    await setStatus(interview.id, InterviewStatus.CONSENTED, { consentedAt: new Date() });
    await saveRuntimeState(interview.id, { consentReceived: true, phase: "AWAITING_CONSENT" });
    await recordEvent(interview.id, "consent_accepted");
    interviewLog("CONSENT_RECEIVED", { interviewId: interview.id, source: "ui" });
    return NextResponse.json({ ok: true, status: InterviewStatus.CONSENTED });
  }

  if (action === "runtime") {
    const patch: Partial<InterviewRuntimeState> = {};
    if (typeof body.openingDelivered === "boolean") patch.openingDelivered = body.openingDelivered;
    if (typeof body.consentReceived === "boolean") patch.consentReceived = body.consentReceived;
    if (typeof body.interviewStarted === "boolean") patch.interviewStarted = body.interviewStarted;
    if (typeof body.completed === "boolean") patch.completed = body.completed;
    if (typeof body.phase === "string") patch.phase = body.phase as InterviewPhase;
    if (typeof body.activeProcess === "string" || body.activeProcess === null) {
      patch.activeProcess = body.activeProcess;
    }
    if (typeof body.lastAssistantTurnId === "string") patch.lastAssistantTurnId = body.lastAssistantTurnId;
    if (typeof body.lastUserTurnId === "string") patch.lastUserTurnId = body.lastUserTurnId;
    if (typeof body.connectionGeneration === "number") patch.connectionGeneration = body.connectionGeneration;
    const state = await saveRuntimeState(interview.id, patch);
    if (patch.openingDelivered) {
      interviewLog("OPENING_TRIGGERED", { interviewId: interview.id, phase: state.phase });
    }
    if (patch.consentReceived) {
      interviewLog("CONSENT_RECEIVED", { interviewId: interview.id, source: "voice", phase: state.phase });
    }
    return NextResponse.json({ ok: true, runtimeState: state });
  }

  if (action === "history") {
    const turns = asHistoryTurns(body.turns);
    const source = body.source === "manual" ? MessageSource.manual : MessageSource.realtime;
    await upsertTranscript(interview.id, turns, source);
    if (interview.status === InterviewStatus.STARTED) {
      await setStatus(interview.id, InterviewStatus.IN_PROGRESS);
    }
    const lastUser = [...turns].reverse().find((turn) => turn.role === "user");
    const lastAssistant = [...turns].reverse().find((turn) => turn.role === "assistant");
    const current = await loadRuntimeState(interview.id);
    const patch: Partial<InterviewRuntimeState> = {};
    if (lastAssistant?.providerEventId) patch.lastAssistantTurnId = lastAssistant.providerEventId;
    if (lastUser?.providerEventId) patch.lastUserTurnId = lastUser.providerEventId;
    if (current.openingDelivered && lastUser && !current.consentReceived) {
      patch.consentReceived = true;
      patch.interviewStarted = true;
      patch.phase = current.activeProcess ? "DEEP_DIVE" : "DISCOVERY";
    }
    if (Object.keys(patch).length) await saveRuntimeState(interview.id, patch);
    return NextResponse.json({ ok: true });
  }

  if (action === "fact") {
    const category = String(body.category ?? "unknown");
    const value = String(body.value ?? "");
    const processName = body.processName ? String(body.processName) : null;
    const evidenceSummary = body.evidenceSummary ? String(body.evidenceSummary) : null;
    const rawTranscript = body.rawTranscript ? String(body.rawTranscript) : null;
    const status = body.status === "UNCERTAIN" || body.status === "INFERRED" ? body.status : "CONFIRMED";
    const decision = decideRecordKeyFact({
      category,
      value,
      processName,
      evidenceSummary,
      status,
      rawTranscript,
      sourceRole: body.sourceRole === "assistant" ? "assistant" : "user",
    });

    if (!decision.record && (decision.reason === "EMPTY" || decision.reason === "ASSISTANT_INFERENCE")) {
      const runtimeState = await loadRuntimeState(interview.id);
      interviewLog("FACT_REJECTED", {
        interviewId: interview.id,
        category,
        reason: decision.reason,
        phase: runtimeState.phase,
      });
      return NextResponse.json({
        ok: true,
        recorded: false,
        reason: decision.reason,
        runtimeState,
        nextQuestion: planNextQuestion(runtimeState),
      });
    }

    const current = await loadRuntimeState(interview.id);
    const committed = commitCanonicalFact(current, {
      category,
      value,
      processName,
      status: decision.record ? decision.status : "UNCERTAIN",
      rawTranscript,
    });
    const finalized = finalizeReasoning(committed.state);
    await persistCanonicalFact(interview.id, committed.fact, evidenceSummary, processName);
    const state = await saveRuntimeState(interview.id, finalized.state, { bumpRevision: true });
    await recordEvent(interview.id, "tool_call", { tool: "record_key_fact", category, factKey: committed.fact.key });
    interviewLog(committed.event, {
      interviewId: interview.id,
      factKey: committed.fact.key,
      category,
      stateRevision: state.stateRevision,
      phase: state.phase,
      reason: decision.record ? undefined : decision.reason,
    });
    if (committed.fact.status === "CONFIRMED" && !canAskQuestion(state, committed.fact.key)) {
      interviewLog("QUESTION_SKIPPED_ALREADY_CONFIRMED", {
        interviewId: interview.id,
        questionKey: committed.fact.key,
        stateRevision: state.stateRevision,
        phase: state.phase,
      });
    }
    return NextResponse.json({
      ok: true,
      recorded: Boolean(decision.record && committed.fact.status === "CONFIRMED"),
      reason: decision.record ? undefined : decision.reason,
      fact: committed.fact,
      runtimeState: state,
      nextQuestion: finalized.nextQuestion,
    });
  }

  if (action === "process") {
    const current = await loadRuntimeState(interview.id);
    const name = String(body.name ?? "");
    const shortReason = String(body.shortReason ?? "");
    const candidates = current.candidateProcesses.filter((item) => item.name !== name);
    candidates.push({ name, shortReason });
    const covered = new Set(current.coveredFields);
    covered.add("workflow");
    const patched: InterviewRuntimeState = {
      ...current,
      candidateProcesses: candidates,
      activeProcess: name || current.activeProcess,
      phase: "DEEP_DIVE",
      coveredFields: [...covered],
    };
    const finalized = finalizeReasoning(patched);
    const state = await saveRuntimeState(interview.id, finalized.state, { bumpRevision: true });
    await recordEvent(interview.id, "tool_call", { tool: "record_process_candidate" });
    interviewLog("TOOL_CALL_COMPLETED", { interviewId: interview.id, tool: "record_process_candidate" });
    return NextResponse.json({
      ok: true,
      recorded: true,
      runtimeState: state,
      nextQuestion: finalized.nextQuestion,
    });
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
    if (!shouldCompleteInterview(interview.status) && interview.status !== InterviewStatus.COMPLETED) {
      if (["ANALYZING", "ANALYZED", "REVIEWED", "FOLLOW_UP_READY", "FAILED"].includes(interview.status)) {
        return NextResponse.json({ ok: true, status: interview.status, alreadyComplete: true });
      }
    }
    const turns = asHistoryTurns(body.turns);
    if (turns.length) {
      await upsertTranscript(
        interview.id,
        turns,
        body.source === "manual" ? MessageSource.manual : MessageSource.realtime,
      );
    }

    if (interview.status === InterviewStatus.COMPLETED || shouldCompleteInterview(interview.status)) {
      if (interview.status !== InterviewStatus.COMPLETED && canTransition(interview.status, InterviewStatus.COMPLETED)) {
        const startedAt = interview.startedAt ?? interview.createdAt;
        const durationSeconds = Math.max(0, Math.round((Date.now() - startedAt.getTime()) / 1000));
        await setStatus(interview.id, InterviewStatus.COMPLETED, {
          completedAt: new Date(),
          durationSeconds,
        });
        await saveRuntimeState(interview.id, { completed: true, phase: "COMPLETED" });
        await recordEvent(interview.id, "session_ended", { reason: "completed" });
        interviewLog("INTERVIEW_COMPLETED", { interviewId: interview.id });
      }
    }

    return NextResponse.json({ ok: true, status: InterviewStatus.COMPLETED });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
