import { EvidenceType, InterviewStatus } from "@prisma/client";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { prisma } from "@/lib/db/prisma";
import { getAnalyzerPrompt } from "@/lib/interview/context";
import { deriveLabor, deriveMonthlyTransactions } from "@/lib/interview/metrics";
import { totalFromBreakdown } from "@/lib/interview/scoring";
import { InterviewAnalysisSchema } from "@/lib/openai/schemas";
import {
  ANALYZER_PROMPT_VERSION,
  ANALYSIS_SCHEMA_VERSION,
} from "@/lib/versions";

function asEvidenceType(value: "EXPLICIT" | "INFERRED" | "DERIVED"): EvidenceType {
  return value;
}

export async function runInterviewAnalysis(interviewId: string) {
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

  await prisma.interview.update({
    where: { id: interviewId },
    data: { status: InterviewStatus.ANALYZING },
  });

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
    provisionalFacts: interview.facts,
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

    await prisma.$transaction(async (tx) => {
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

      const messagesBySeq = new Map(interview.messages.map((m) => [m.sequenceNo, m.id]));

      for (const process of parsed.processes) {
        const monthly = deriveMonthlyTransactions({
          perDayMin: process.volume.perDayMin,
          perDayMax: process.volume.perDayMax,
          perMonthMin: process.volume.perMonthMin,
          perMonthMax: process.volume.perMonthMax,
        });
        const labor = deriveLabor({
          monthlyTransactionsMin: monthly.min,
          monthlyTransactionsMax: monthly.max,
          minutesPerTransactionMin: process.labor.minutesPerTransactionMin,
          minutesPerTransactionMax: process.labor.minutesPerTransactionMax,
          manualHoursMonthMin: process.labor.manualHoursMonthMin,
          manualHoursMonthMax: process.labor.manualHoursMonthMax,
        });

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
            manualHoursMonthMin: labor.hours.min,
            manualHoursMonthMax: labor.hours.max,
            fteMin: labor.fte.min,
            fteMax: labor.fte.max,
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
              create: process.evidence.map((ev) => ({
                fieldName: ev.field,
                evidenceText: ev.excerpt,
                evidenceType: asEvidenceType(ev.type),
                confidence: ev.confidence,
                messageId: messagesBySeq.get(ev.messageSequence) ?? null,
              })),
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
    });

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
