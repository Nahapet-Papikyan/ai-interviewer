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
    });
  }
  return facts;
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

export function parseRuntimeState(raw: unknown): InterviewRuntimeState {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_RUNTIME_STATE };
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
  };
}

function factLine(fact: RuntimeFact) {
  const process = fact.processName ? ` (${fact.processName})` : "";
  return `- ${fact.category}: ${fact.value}${process}`;
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
      "Confirmed facts:",
      confirmed,
      "Uncertain facts:",
      uncertain,
      `Already covered: ${covered}`,
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
