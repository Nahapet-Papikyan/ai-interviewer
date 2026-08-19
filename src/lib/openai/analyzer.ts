import { EvidenceType, InterviewStatus } from "@prisma/client";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { prisma } from "@/lib/db/prisma";
import { isReliableNumericSource, laborLooksContradictory } from "@/lib/interview/facts";
import { getAnalyzerPrompt } from "@/lib/interview/context";
import { interviewLog } from "@/lib/interview/logging";
import { deriveLabor, deriveMonthlyTransactions, laborTotalsForProcess, rangeFromMinMax } from "@/lib/interview/metrics";
import { isAnalysisRunningOrDone, shouldStartAnalysis } from "@/lib/interview/runtime-state";
import { totalFromBreakdown } from "@/lib/interview/scoring";
import { InterviewAnalysisSchema, type InterviewAnalysis } from "@/lib/openai/schemas";
import {
  ANALYZER_PROMPT_VERSION,
  ANALYSIS_SCHEMA_VERSION,
  WEEKS_PER_MONTH,
} from "@/lib/versions";

function asEvidenceType(value: "EXPLICIT" | "INFERRED" | "DERIVED"): EvidenceType {
  return value;
}

function volumeIsReliable(
  process: InterviewAnalysis["processes"][number],
  messagesBySeq: Map<number, { role: string }>,
) {
  if (process.volume.basis === "UNKNOWN") return false;
  const related = process.evidence.filter((ev) =>
    /volume|perDay|perWeek|perMonth|transaction/i.test(ev.field),
  );
  if (related.length === 0) return process.volume.basis === "EXPLICIT";
  return related.every((ev) =>
    isReliableNumericSource({
      evidenceType: ev.type,
      confidence: ev.confidence,
      sourceRole: messagesBySeq.get(ev.messageSequence)?.role,
    }),
  );
}

function laborIsReliable(
  process: InterviewAnalysis["processes"][number],
  messagesBySeq: Map<number, { role: string }>,
) {
  const related = process.evidence.filter((ev) =>
    /labor|minute|hour|people|fte|time/i.test(ev.field),
  );
  if (related.length === 0) return false;
  return related.every((ev) =>
    isReliableNumericSource({
      evidenceType: ev.type,
      confidence: ev.confidence,
      sourceRole: messagesBySeq.get(ev.messageSequence)?.role,
    }),
  );
}

export async function runInterviewAnalysis(interviewId: string, options?: { force?: boolean }) {
  const interview = await prisma.interview.findUnique({
    where: { id: interviewId },
    include: {
      company: true,
      contact: true,
      messages: { orderBy: { sequenceNo: "asc" } },
      facts: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!interview) throw new Error("Interview not found");
  if (interview.messages.length === 0) throw new Error("No transcript to analyze");

  if (!options?.force && isAnalysisRunningOrDone(interview.status)) {
    interviewLog("ANALYSIS_STARTED", { interviewId, skipped: true, status: interview.status });
    return null;
  }

  if (!shouldStartAnalysis(interview.status, options?.force) && interview.status !== InterviewStatus.ANALYZING) {
    throw new Error(`Interview is not ready for analysis (${interview.status})`);
  }

  const claimed = await prisma.interview.updateMany({
    where: {
      id: interviewId,
      status: options?.force
        ? {
            in: [
              InterviewStatus.COMPLETED,
              InterviewStatus.FAILED,
              InterviewStatus.ABANDONED,
              InterviewStatus.STARTED,
              InterviewStatus.IN_PROGRESS,
              InterviewStatus.ANALYZED,
              InterviewStatus.REVIEWED,
              InterviewStatus.FOLLOW_UP_READY,
              InterviewStatus.ANALYZING,
            ],
          }
        : { in: [InterviewStatus.COMPLETED, InterviewStatus.FAILED] },
    },
    data: { status: InterviewStatus.ANALYZING },
  });
  if (claimed.count === 0 && interview.status !== InterviewStatus.ANALYZING) {
    return null;
  }

  interviewLog("ANALYSIS_STARTED", { interviewId, force: Boolean(options?.force) });

  const transcript = interview.messages
    .map((m) => `[${m.sequenceNo}] ${m.role.toUpperCase()}: ${m.contentText}`)
    .join("\n");

  const payload = {
    company: {
      name: interview.company.name,
      vertical: interview.company.vertical,
      verifiedFacts: interview.company.verifiedFacts,
      hypotheses: interview.company.hypotheses,
    },
    respondent: {
      name: `${interview.contact.firstName} ${interview.contact.lastName ?? ""}`.trim(),
      role: interview.contact.role,
    },
    provisionalFacts: interview.facts.map((fact) => ({
      category: fact.category,
      value: fact.value,
      processName: fact.processName,
      evidenceSummary: fact.evidenceSummary,
      status: fact.status,
      confidence: fact.confidence,
      sourceRole: fact.sourceRole,
      rawTranscript: fact.rawTranscript,
    })),
    transcript,
  };

  const model = process.env.OPENAI_ANALYSIS_MODEL ?? "gpt-5.6-terra";
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const response = await client.responses.parse({
      model,
      input: [
        { role: "system", content: getAnalyzerPrompt() },
        {
          role: "user",
          content: JSON.stringify(payload, null, 2),
        },
      ],
      text: {
        format: zodTextFormat(InterviewAnalysisSchema, "interview_analysis"),
      },
    });

    const parsed = response.output_parsed;
    if (!parsed) {
      throw new Error("Analyzer returned no parsed output");
    }

    await prisma.$transaction(
      async (tx) => {
      await tx.process.deleteMany({ where: { interviewId } });

      const analysis = await tx.interviewAnalysis.create({
        data: {
          interviewId,
          model,
          promptVersion: ANALYZER_PROMPT_VERSION,
          schemaVersion: ANALYSIS_SCHEMA_VERSION,
          rawJson: parsed,
        },
      });

      const messagesBySeq = new Map(interview.messages.map((m) => [m.sequenceNo, m]));

      for (const process of parsed.processes) {
        const reliableVolume = volumeIsReliable(process, messagesBySeq);
        const reliableLabor = laborIsReliable(process, messagesBySeq);
        const monthly = deriveMonthlyTransactions({
          perDayMin: process.volume.perDayMin,
          perDayMax: process.volume.perDayMax,
          perMonthMin: process.volume.perMonthMin,
          perMonthMax: process.volume.perMonthMax,
          weeklyMin: process.volume.perWeekMin,
          weeklyMax: process.volume.perWeekMax,
          reliable: reliableVolume,
        });
        const weeklyVolumeMax =
          process.volume.perWeekMax ??
          (monthly.max != null ? monthly.max / WEEKS_PER_MONTH : null);
        const minutesMax =
          process.labor.minutesPerTransactionMax ?? process.labor.minutesPerTransactionMin ?? null;
        const contradictory = laborLooksContradictory({
          weeklyVolume: weeklyVolumeMax,
          minutesEach: minutesMax,
          people: process.labor.peopleInvolved,
        });
        const labor = deriveLabor({
          monthlyTransactionsMin: monthly.min,
          monthlyTransactionsMax: monthly.max,
          minutesPerTransactionMin: process.labor.minutesPerTransactionMin,
          minutesPerTransactionMax: process.labor.minutesPerTransactionMax,
          manualHoursMonthMin: process.labor.manualHoursMonthMin,
          manualHoursMonthMax: process.labor.manualHoursMonthMax,
          reliable: reliableVolume && reliableLabor,
          contradictory,
        });
        const stageLimited = Boolean(process.labor.knownStagesOnly || process.labor.additionalLaborUnknown);
        const totals = laborTotalsForProcess({
          knownStageHours: rangeFromMinMax(labor.hours.min, labor.hours.max),
          knownStagesOnly: process.labor.knownStagesOnly,
          additionalLaborUnknown: process.labor.additionalLaborUnknown,
        });
        if (stageLimited) {
          labor.hours = totals.totalLabor;
          labor.fte = { min: null, max: null, pointEstimate: null };
          labor.assumptions = [
            ...labor.assumptions,
            "total process labor unknown because only known-stage time was measured",
          ];
        }

        const breakdown = {
          volume: process.scoring.volume,
          manualLabor: process.scoring.manualLabor,
          repetitiveness: process.scoring.repetitiveness,
          digitalInput: process.scoring.digitalInput,
          systemAccessibility: process.scoring.systemAccessibility,
          businessImpact: process.scoring.businessImpact,
          reusePotential: process.scoring.reusePotential,
          pilotReadiness: process.scoring.pilotReadiness,
          penalties: process.scoring.penalties,
        };
        const total = totalFromBreakdown(breakdown);

        const created = await tx.process.create({
          data: {
            interviewId,
            name: process.name,
            description: process.purpose,
            trigger: process.trigger,
            frequencyRaw: process.volume.rawStatement,
            transactionsDayMin: process.volume.perDayMin,
            transactionsDayMax: process.volume.perDayMax,
            transactionsMonthMin: monthly.min,
            transactionsMonthMax: monthly.max,
            minutesTransactionMin: process.labor.minutesPerTransactionMin,
            minutesTransactionMax: process.labor.minutesPerTransactionMax,
            employeesInvolved: process.labor.peopleInvolved,
            manualHoursMonthMin: stageLimited ? null : labor.hours.min,
            manualHoursMonthMax: stageLimited ? null : labor.hours.max,
            fteMin: stageLimited ? null : labor.fte.min,
            fteMax: stageLimited ? null : labor.fte.max,
            automationScore: total,
            confidence: process.automation.confidence,
            clusterTag: parsed.crossInterviewTags[0] ?? process.name,
            steps: {
              create: process.steps.map((step) => ({
                stepNo: step.order,
                actor: step.actor,
                action: step.action,
                system: step.system,
                manual: step.manual,
              })),
            },
            systems: {
              create: process.systems.map((system) => ({
                name: system.name,
                category: system.role,
              })),
            },
            evidence: {
              create: process.evidence.map((ev) => {
                const message = messagesBySeq.get(ev.messageSequence);
                const evidenceType =
                  ev.type === "EXPLICIT" && message?.role === "assistant" ? "INFERRED" : ev.type;
                return {
                  fieldName: ev.field,
                  evidenceText: ev.excerpt,
                  evidenceType: asEvidenceType(evidenceType),
                  confidence: ev.confidence,
                  messageId: message?.id ?? null,
                };
              }),
            },
            opportunity: {
              create: {
                scoreTotal: total,
                scoreBreakdown: { ...breakdown, total, rationale: process.scoring.rationale },
                automationHypothesis: process.automation.hypothesis,
                integrationRequirements: process.automation.requiredIntegrations,
                risks: process.automation.keyRisks,
                pilotDataNeeded: process.automation.requiredPilotData,
                pilotReadiness: parsed.pilot.willingness,
              },
            },
          },
        });

        void created;
        void analysis;
      }

      await tx.interview.update({
        where: { id: interviewId },
        data: {
          status: InterviewStatus.ANALYZED,
          analysisVersion: ANALYZER_PROMPT_VERSION,
          schemaVersion: ANALYSIS_SCHEMA_VERSION,
        },
      });
    },
      { timeout: 60_000 },
    );

    return parsed;
  } catch (error) {
    await prisma.interview.update({
      where: { id: interviewId },
      data: { status: InterviewStatus.FAILED },
    });
    await prisma.interviewEvent.create({
      data: {
        interviewId,
        type: "analysis_failed",
        payload: { message: error instanceof Error ? error.message : "unknown" },
      },
    });
    throw error;
  }
}
