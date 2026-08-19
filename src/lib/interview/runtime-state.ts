import type { CanonicalFact, NextQuestionPlan, QuestionState } from "@/lib/interview/reasoning-state";
import type { StructuredQuantity } from "@/lib/interview/quantities";

export const INTERVIEW_PHASES = [
  "INITIALIZING",
  "AWAITING_CONSENT",
  "DISCOVERY",
  "DEEP_DIVE",
  "PRIORITIZATION",
  "PILOT",
  "CLOSING",
  "COMPLETED",
] as const;

export type InterviewPhase = (typeof INTERVIEW_PHASES)[number];

export type FactStatus = "CONFIRMED" | "UNCERTAIN" | "INFERRED";

export type RuntimeFact = {
  category: string;
  value: string;
  processName?: string;
  status: FactStatus;
  rawTranscript?: string;
  factKey?: string;
  quantity?: StructuredQuantity;
};

export type InterviewRuntimeState = {
  phase: InterviewPhase;
  openingDelivered: boolean;
  consentReceived: boolean;
  interviewStarted: boolean;
  activeProcess: string | null;
  completed: boolean;
  lastAssistantTurnId: string | null;
  lastUserTurnId: string | null;
  coveredFields: string[];
  confirmedFacts: RuntimeFact[];
  uncertainFacts: RuntimeFact[];
  candidateProcesses: Array<{ name: string; shortReason: string }>;
  connectionGeneration: number;
  stateRevision: number;
  canonicalFacts: CanonicalFact[];
  questionStates: QuestionState[];
  lastPlan: NextQuestionPlan | null;
};

export const DEFAULT_RUNTIME_STATE: InterviewRuntimeState = {
  phase: "INITIALIZING",
  openingDelivered: false,
  consentReceived: false,
  interviewStarted: false,
  activeProcess: null,
  completed: false,
  lastAssistantTurnId: null,
  lastUserTurnId: null,
  coveredFields: [],
  confirmedFacts: [],
  uncertainFacts: [],
  candidateProcesses: [],
  connectionGeneration: 0,
  stateRevision: 0,
  canonicalFacts: [],
  questionStates: [],
  lastPlan: null,
};

type MessageLike = {
  role?: string;
  contentText?: string;
  content?: string;
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function asRuntimeFacts(value: unknown): RuntimeFact[] {
  if (!Array.isArray(value)) return [];
  const facts: RuntimeFact[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    if (typeof rec.value !== "string" || typeof rec.category !== "string") continue;
    const status = rec.status === "UNCERTAIN" || rec.status === "INFERRED" ? rec.status : "CONFIRMED";
    facts.push({
      category: rec.category,
      value: rec.value,
      processName: typeof rec.processName === "string" ? rec.processName : undefined,
      status,
      rawTranscript: typeof rec.rawTranscript === "string" ? rec.rawTranscript : undefined,
      factKey: typeof rec.factKey === "string" ? rec.factKey : undefined,
      quantity: asQuantity(rec.quantity),
    });
  }
  return facts;
}

function asQuantity(value: unknown): StructuredQuantity | undefined {
  if (!value || typeof value !== "object") return undefined;
  const rec = value as Record<string, unknown>;
  const min = typeof rec.min === "number" ? rec.min : null;
  const max = typeof rec.max === "number" ? rec.max : null;
  const unit = typeof rec.unit === "string" ? rec.unit : "unknown";
  return {
    min,
    max,
    unit: unit as StructuredQuantity["unit"],
    period: (typeof rec.period === "string" ? rec.period : null) as StructuredQuantity["period"],
    scope: (typeof rec.scope === "string" ? rec.scope : null) as StructuredQuantity["scope"],
    stage: typeof rec.stage === "string" ? rec.stage : null,
    approximate: Boolean(rec.approximate),
    uncertain: Boolean(rec.uncertain),
    raw: typeof rec.raw === "string" ? rec.raw : "",
  };
}

function asCanonicalFacts(value: unknown): CanonicalFact[] {
  if (!Array.isArray(value)) return [];
  const facts: CanonicalFact[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    if (typeof rec.key !== "string" || typeof rec.category !== "string" || typeof rec.value !== "string") continue;
    const status =
      rec.status === "UNCERTAIN" || rec.status === "CONFLICT" || rec.status === "INFERRED"
        ? rec.status
        : "CONFIRMED";
    facts.push({
      key: rec.key,
      category: rec.category,
      processKey: typeof rec.processKey === "string" ? rec.processKey : null,
      value: rec.value,
      quantity: asQuantity(rec.quantity) ?? null,
      previousQuantity: asQuantity(rec.previousQuantity) ?? null,
      status,
      confidence: typeof rec.confidence === "number" ? rec.confidence : undefined,
      confirmationCount: typeof rec.confirmationCount === "number" ? rec.confirmationCount : status === "CONFIRMED" ? 1 : 0,
      sourceMessageIds: asStringArray(rec.sourceMessageIds),
      rawTranscript: typeof rec.rawTranscript === "string" ? rec.rawTranscript : undefined,
    });
  }
  return facts;
}

function asQuestionStates(value: unknown): QuestionState[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const rec = item as Record<string, unknown>;
    if (typeof rec.key !== "string") return [];
    const status =
      rec.status === "ASKED" ||
      rec.status === "PARTIAL" ||
      rec.status === "CONFIRMED" ||
      rec.status === "SKIPPED"
        ? rec.status
        : "NOT_ASKED";
    return [
      {
        key: rec.key,
        status,
        askedCount: typeof rec.askedCount === "number" ? rec.askedCount : 0,
        clarificationCount: typeof rec.clarificationCount === "number" ? rec.clarificationCount : 0,
        lastAskedAt: typeof rec.lastAskedAt === "string" ? rec.lastAskedAt : undefined,
        answeredByMessageIds: asStringArray(rec.answeredByMessageIds),
        missingSlots: asStringArray(rec.missingSlots),
      },
    ];
  });
}

function asPlan(value: unknown): NextQuestionPlan | null {
  if (!value || typeof value !== "object") return null;
  const rec = value as Record<string, unknown>;
  const reason =
    rec.reason === "CLARIFICATION" ||
    rec.reason === "CONFLICT" ||
    rec.reason === "PRIORITIZATION" ||
    rec.reason === "PILOT" ||
    rec.reason === "COMPLETE"
      ? rec.reason
      : "MISSING_FIELD";
  return {
    questionKey: typeof rec.questionKey === "string" ? rec.questionKey : null,
    intent: typeof rec.intent === "string" ? rec.intent : null,
    processKey: typeof rec.processKey === "string" ? rec.processKey : null,
    missingSlots: asStringArray(rec.missingSlots),
    reason,
    shouldAsk: Boolean(rec.shouldAsk),
  };
}

function asCandidates(value: unknown): Array<{ name: string; shortReason: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const rec = item as Record<string, unknown>;
      const name = typeof rec.name === "string" ? rec.name : "";
      const shortReason =
        typeof rec.shortReason === "string"
          ? rec.shortReason
          : typeof rec.short_reason === "string"
            ? rec.short_reason
            : "";
      if (!name) return null;
      return { name, shortReason };
    })
    .filter((item): item is { name: string; shortReason: string } => item !== null);
}

function isPhase(value: unknown): value is InterviewPhase {
  return typeof value === "string" && (INTERVIEW_PHASES as readonly string[]).includes(value);
}

export function emptyRuntimeState(): InterviewRuntimeState {
  return {
    ...DEFAULT_RUNTIME_STATE,
    coveredFields: [],
    confirmedFacts: [],
    uncertainFacts: [],
    candidateProcesses: [],
    canonicalFacts: [],
    questionStates: [],
    lastPlan: null,
  };
}

export function parseRuntimeState(raw: unknown): InterviewRuntimeState {
  if (!raw || typeof raw !== "object") return emptyRuntimeState();
  const rec = raw as Record<string, unknown>;
  return {
    phase: isPhase(rec.phase) ? rec.phase : DEFAULT_RUNTIME_STATE.phase,
    openingDelivered: Boolean(rec.openingDelivered),
    consentReceived: Boolean(rec.consentReceived),
    interviewStarted: Boolean(rec.interviewStarted),
    activeProcess: typeof rec.activeProcess === "string" ? rec.activeProcess : null,
    completed: Boolean(rec.completed),
    lastAssistantTurnId: typeof rec.lastAssistantTurnId === "string" ? rec.lastAssistantTurnId : null,
    lastUserTurnId: typeof rec.lastUserTurnId === "string" ? rec.lastUserTurnId : null,
    coveredFields: asStringArray(rec.coveredFields),
    confirmedFacts: asRuntimeFacts(rec.confirmedFacts),
    uncertainFacts: asRuntimeFacts(rec.uncertainFacts),
    candidateProcesses: asCandidates(rec.candidateProcesses),
    connectionGeneration:
      typeof rec.connectionGeneration === "number" ? rec.connectionGeneration : 0,
    stateRevision: typeof rec.stateRevision === "number" ? rec.stateRevision : 0,
    canonicalFacts: asCanonicalFacts(rec.canonicalFacts),
    questionStates: asQuestionStates(rec.questionStates),
    lastPlan: asPlan(rec.lastPlan),
  };
}

export function hydrateRuntimeState(raw: unknown, messages: MessageLike[] = []): InterviewRuntimeState {
  const state = parseRuntimeState(raw);
  const hasAssistant = messages.some((message) => message.role === "assistant");
  const hasUser = messages.some((message) => message.role === "user");

  if (hasAssistant) {
    state.openingDelivered = true;
    if (state.phase === "INITIALIZING") {
      state.phase = hasUser ? "DISCOVERY" : "AWAITING_CONSENT";
    }
  }
  if (hasUser && state.openingDelivered) {
    state.consentReceived = true;
    state.interviewStarted = true;
    if (state.phase === "AWAITING_CONSENT" || state.phase === "INITIALIZING") {
      state.phase = state.activeProcess ? "DEEP_DIVE" : "DISCOVERY";
    }
  }
  if (state.completed) {
    state.phase = "COMPLETED";
  }
  return state;
}

export function mergeRuntimeState(
  current: InterviewRuntimeState,
  patch: Partial<InterviewRuntimeState>,
): InterviewRuntimeState {
  return {
    ...current,
    ...patch,
    openingDelivered: current.openingDelivered || Boolean(patch.openingDelivered),
    consentReceived: current.consentReceived || Boolean(patch.consentReceived),
    interviewStarted: current.interviewStarted || Boolean(patch.interviewStarted),
    completed: current.completed || Boolean(patch.completed),
    coveredFields: patch.coveredFields ?? current.coveredFields,
    confirmedFacts: patch.confirmedFacts ?? current.confirmedFacts,
    uncertainFacts: patch.uncertainFacts ?? current.uncertainFacts,
    candidateProcesses: patch.candidateProcesses ?? current.candidateProcesses,
    activeProcess: patch.activeProcess === undefined ? current.activeProcess : patch.activeProcess,
    phase: patch.phase ?? current.phase,
    stateRevision: patch.stateRevision ?? current.stateRevision,
    canonicalFacts: patch.canonicalFacts ?? current.canonicalFacts,
    questionStates: patch.questionStates ?? current.questionStates,
    lastPlan: patch.lastPlan === undefined ? current.lastPlan : patch.lastPlan,
  };
}

export function applyAuthoritativeRuntimeState(
  current: InterviewRuntimeState,
  incoming: unknown,
  messages: MessageLike[] = [],
): InterviewRuntimeState {
  const next = hydrateRuntimeState(incoming, messages);
  if (next.stateRevision < current.stateRevision) return current;
  return next;
}

function factLine(fact: RuntimeFact) {
  const process = fact.processName ? ` (${fact.processName})` : "";
  const key = fact.factKey ? ` [${fact.factKey}]` : "";
  return `- ${fact.category}: ${fact.value}${process}${key}`;
}

function canonicalLine(fact: CanonicalFact) {
  return `- ${fact.key}: ${fact.value} (${fact.status})`;
}

export function buildRuntimeStatePrompt(state: InterviewRuntimeState): string {
  const confirmed =
    state.confirmedFacts.length > 0
      ? state.confirmedFacts.map(factLine).join("\n")
      : "- none";
  const uncertain =
    state.uncertainFacts.length > 0
      ? state.uncertainFacts.map(factLine).join("\n")
      : "- none";
  const covered = state.coveredFields.length > 0 ? state.coveredFields.join(", ") : "none yet";
  const candidates =
    state.candidateProcesses.length > 0
      ? state.candidateProcesses.map((item) => `- ${item.name}`).join("\n")
      : "- none";

  if (state.openingDelivered) {
    return [
      "INTERVIEW RUNTIME STATE",
      "This is a continuation of an existing interview.",
      `Opening already completed: yes`,
      `Consent received: ${state.consentReceived ? "yes" : "no"}`,
      `Current phase: ${state.phase}`,
      `Active process: ${state.activeProcess ?? "none"}`,
      "Candidate processes:",
      candidates,
      "Canonical facts:",
      state.canonicalFacts.length ? state.canonicalFacts.map(canonicalLine).join("\n") : "- none",
      "Confirmed facts:",
      confirmed,
      "Uncertain facts:",
      uncertain,
      `Already covered: ${covered}`,
      state.lastPlan?.intent
        ? `NEXT INTERVIEW INTENT (authoritative): ${state.lastPlan.intent}`
        : "Ask the next missing high-value field. Never re-ask confirmed keys.",
      "Continue naturally from the current topic.",
      "Do not greet, re-introduce yourself, or ask permission to begin again.",
      "Never restart the interview.",
    ].join("\n");
  }

  return [
    "INTERVIEW RUNTIME STATE",
    "Opening delivered: no",
    "Consent received: no",
    `Current phase: ${state.phase}`,
    "Active process: none",
    "Confirmed facts: none",
    "Uncertain facts: none",
    "Speak first and deliver the opening exactly once, then wait for consent.",
    "Never restart the interview after the opening.",
  ].join("\n");
}

export function buildCompactRuntimeUpdate(state: InterviewRuntimeState): string {
  const confirmed = state.canonicalFacts.filter((fact) => fact.status === "CONFIRMED");
  const lines = [
    "INTERVIEW STATE UPDATE",
    `revision: ${state.stateRevision}`,
    `phase: ${state.phase}`,
    "Confirmed:",
    confirmed.length ? confirmed.map(canonicalLine).join("\n") : "- none",
    "Do not ask confirmed facts again.",
    state.lastPlan?.shouldAsk && state.lastPlan.intent
      ? `Next question: ${state.lastPlan.questionKey ?? ""} — ${state.lastPlan.intent}`
      : "No further required question from the planner.",
  ];
  return lines.join("\n");
}

export function shouldTriggerOpening(input: {
  openingDelivered: boolean;
  completed: boolean;
  isReconnect: boolean;
  assistantTurnCount: number;
}): boolean {
  if (input.completed) return false;
  if (input.openingDelivered) return false;
  if (input.isReconnect) return false;
  if (input.assistantTurnCount > 0) return false;
  return true;
}

export function shouldConnectRealtime(status: string): boolean {
  return !["COMPLETED", "ANALYZING", "ANALYZED", "REVIEWED", "FOLLOW_UP_READY"].includes(status);
}

export function shouldCompleteInterview(status: string): boolean {
  return status === "STARTED" || status === "IN_PROGRESS" || status === "CONSENTED";
}

export function shouldStartAnalysis(status: string, force = false): boolean {
  if (!force) return false;
  return [
    "COMPLETED",
    "FAILED",
    "ABANDONED",
    "STARTED",
    "IN_PROGRESS",
    "ANALYZED",
    "REVIEWED",
    "FOLLOW_UP_READY",
    "ANALYZING",
  ].includes(status);
}

export function isAnalysisRunningOrDone(status: string): boolean {
  return ["ANALYZING", "ANALYZED", "REVIEWED", "FOLLOW_UP_READY"].includes(status);
}
