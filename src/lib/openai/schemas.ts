import { z } from "zod";

export const InterviewAnalysisSchema = z.object({
  interviewSummary: z.object({
    quality: z.enum(["HIGH", "MEDIUM", "LOW"]),
    respondentKnowledge: z.enum(["HIGH", "MEDIUM", "LOW"]),
    keyTakeaway: z.string(),
    limitations: z.array(z.string()),
  }),
  processes: z.array(
    z.object({
      name: z.string(),
      purpose: z.string().nullable(),
      trigger: z.string().nullable(),
      output: z.string().nullable(),
      steps: z.array(
        z.object({
          order: z.number(),
          actor: z.string().nullable(),
          action: z.string(),
          system: z.string().nullable(),
          manual: z.boolean().nullable(),
        }),
      ),
      volume: z.object({
        rawStatement: z.string().nullable(),
        perDayMin: z.number().nullable(),
        perDayMax: z.number().nullable(),
        perWeekMin: z.number().nullable().optional(),
        perWeekMax: z.number().nullable().optional(),
        perMonthMin: z.number().nullable(),
        perMonthMax: z.number().nullable(),
        basis: z.enum(["EXPLICIT", "DERIVED", "UNKNOWN"]),
        assumptions: z.array(z.string()),
      }),
      labor: z.object({
        peopleInvolved: z.number().nullable(),
        minutesPerTransactionMin: z.number().nullable(),
        minutesPerTransactionMax: z.number().nullable(),
        manualHoursMonthMin: z.number().nullable(),
        manualHoursMonthMax: z.number().nullable(),
        fteMin: z.number().nullable(),
        fteMax: z.number().nullable(),
        assumptions: z.array(z.string()),
        knownStagesOnly: z.boolean().optional(),
        additionalLaborUnknown: z.boolean().optional(),
      }),
      systems: z.array(
        z.object({
          name: z.string(),
          role: z.enum(["INPUT", "WORK", "OUTPUT", "UNKNOWN"]),
          integrationKnown: z.boolean(),
          integrationNotes: z.string().nullable(),
        }),
      ),
      errors: z.array(
        z.object({
          type: z.string(),
          frequency: z.string().nullable(),
          consequence: z.string().nullable(),
          costKnown: z.boolean(),
        }),
      ),
      bottlenecks: z.array(z.string()),
      existingAutomation: z.array(z.string()),
      businessImpact: z.object({
        time: z.enum(["HIGH", "MEDIUM", "LOW", "UNKNOWN"]),
        errors: z.enum(["HIGH", "MEDIUM", "LOW", "UNKNOWN"]),
        throughput: z.enum(["HIGH", "MEDIUM", "LOW", "UNKNOWN"]),
        customer: z.enum(["HIGH", "MEDIUM", "LOW", "UNKNOWN"]),
        cashflow: z.enum(["HIGH", "MEDIUM", "LOW", "UNKNOWN"]),
      }),
      automation: z.object({
        hypothesis: z.string(),
        humanInLoop: z.array(z.string()),
        requiredIntegrations: z.array(z.string()),
        requiredPilotData: z.array(z.string()),
        feasibility: z.enum(["HIGH", "MEDIUM", "LOW", "UNKNOWN"]),
        confidence: z.number().min(0).max(1),
        keyRisks: z.array(z.string()),
      }),
      scoring: z.object({
        volume: z.number().min(0).max(20),
        manualLabor: z.number().min(0).max(20),
        repetitiveness: z.number().min(0).max(15),
        digitalInput: z.number().min(0).max(10),
        systemAccessibility: z.number().min(0).max(10),
        businessImpact: z.number().min(0).max(10),
        reusePotential: z.number().min(0).max(10),
        pilotReadiness: z.number().min(0).max(5),
        penalties: z.number().max(0),
        total: z.number().min(0).max(100),
        rationale: z.string(),
      }),
      evidence: z.array(
        z.object({
          field: z.string(),
          messageSequence: z.number(),
          excerpt: z.string(),
          type: z.enum(["EXPLICIT", "INFERRED", "DERIVED"]),
          confidence: z.number().min(0).max(1),
        }),
      ),
      missingCriticalData: z.array(z.string()),
    }),
  ),
  pilot: z.object({
    willingness: z.enum(["YES", "MAYBE", "NO", "NOT_ASKED"]),
    dataAvailability: z.enum(["YES", "MAYBE", "NO", "UNKNOWN"]),
    decisionMakers: z.array(z.string()),
    blockers: z.array(z.string()),
  }),
  followUpQuestions: z.array(z.string()).max(5),
  crossInterviewTags: z.array(z.string()),
});

export type InterviewAnalysis = z.infer<typeof InterviewAnalysisSchema>;
