import {
  buildFactKey,
  canonicalIdentity,
  processKeyFromName,
  quantityFromFactText,
} from "@/lib/interview/fact-identity";
import {
  mergeQuantity,
  quantitiesSemanticallyEqual,
  quantityHasCoreNumber,
  quantityToDisplayString,
  type StructuredQuantity,
} from "@/lib/interview/quantities";
import type { FactStatus, InterviewRuntimeState, RuntimeFact } from "@/lib/interview/runtime-state";

export const MAX_CLARIFICATION_ATTEMPTS = 2;

export type CanonicalFactStatus = "UNCERTAIN" | "CONFIRMED" | "CONFLICT" | "INFERRED";

export type CanonicalFact = {
  key: string;
  category: string;
  processKey?: string | null;
  value: string;
  quantity: StructuredQuantity | null;
  previousQuantity?: StructuredQuantity | null;
  status: CanonicalFactStatus;
  confidence?: number;
  confirmationCount: number;
  sourceMessageIds: string[];
  rawTranscript?: string;
};

export type QuestionStatus = "NOT_ASKED" | "ASKED" | "PARTIAL" | "CONFIRMED" | "SKIPPED";

export type QuestionState = {
  key: string;
  status: QuestionStatus;
  askedCount: number;
  clarificationCount: number;
  lastAskedAt?: string;
  answeredByMessageIds?: string[];
  missingSlots?: string[];
};

export type NextQuestionPlan = {
  questionKey: string | null;
  intent: string | null;
  processKey?: string | null;
  missingSlots?: string[];
  reason: "MISSING_FIELD" | "CLARIFICATION" | "CONFLICT" | "PRIORITIZATION" | "PILOT" | "COMPLETE";
  shouldAsk: boolean;
};

export type FactCommitInput = {
  category: string;
  value: string;
  processName?: string | null;
  status: CanonicalFactStatus | FactStatus;
  rawTranscript?: string | null;
  sourceMessageId?: string | null;
  confidence?: number;
};

export function missingQuantitySlots(category: string, quantity?: StructuredQuantity | null): string[] {
  const missing: string[] = [];
  if (!quantityHasCoreNumber(quantity)) missing.push("number");
  if (category === "volume") {
    if (!quantity?.period) missing.push("period");
    if (!quantity?.scope || quantity.scope === "unknown") missing.push("scope");
    if (!quantity?.stage) missing.push("stage");
    if (!quantity?.unit || quantity.unit === "unknown") missing.push("unit");
  }
  if (category === "time") {
    if (!quantity?.unit || quantity.unit === "unknown") missing.push("unit");
    if (!quantity?.period) missing.push("period");
    if (!quantity?.stage) missing.push("stage");
  }
  if (category === "people") {
    if (!quantity?.stage) missing.push("stage");
  }
  return missing;
}

function toRuntimeFact(fact: CanonicalFact): RuntimeFact {
  return {
    category: fact.category,
    value: fact.value,
    processName: fact.processKey ?? undefined,
    status: fact.status === "CONFLICT" ? "UNCERTAIN" : fact.status === "INFERRED" ? "INFERRED" : fact.status,
    rawTranscript: fact.rawTranscript,
    factKey: fact.key,
    quantity: fact.quantity ?? undefined,
  };
}

export function deriveCoveredFields(facts: CanonicalFact[], existing: string[] = []): string[] {
  const covered = new Set(existing);
  for (const fact of facts) {
    if (fact.status !== "CONFIRMED") continue;
    if (missingQuantitySlots(fact.category, fact.quantity).length > 0 && ["volume", "time", "people"].includes(fact.category)) {
      continue;
    }
    if (fact.category === "volume") covered.add("volume");
    if (fact.category === "time") covered.add("active_time");
    if (fact.category === "people") covered.add("people");
    if (fact.category === "system") covered.add("systems");
    if (fact.category === "error") covered.add("errors");
    if (fact.category === "impact") covered.add("consequences");
    if (fact.category === "pilot") covered.add("pilot");
  }
  return [...covered];
}

export function migrateCanonicalFacts(state: InterviewRuntimeState): CanonicalFact[] {
  if (state.canonicalFacts.length > 0) return state.canonicalFacts;
  const fromConfirmed = state.confirmedFacts.map((fact) => runtimeFactToCanonical(fact, "CONFIRMED"));
  const fromUncertain = state.uncertainFacts.map((fact) => runtimeFactToCanonical(fact, "UNCERTAIN"));
  return dedupeCanonical([...fromConfirmed, ...fromUncertain]);
}

function runtimeFactToCanonical(fact: RuntimeFact, status: CanonicalFactStatus): CanonicalFact {
  const quantity = fact.quantity ?? quantityFromFactText(fact.value, fact.rawTranscript, fact.factKey);
  const key = fact.factKey || buildFactKey({ category: fact.category, quantity });
  return {
    key,
    category: fact.category,
    processKey: processKeyFromName(fact.processName) ?? fact.processName ?? null,
    value: fact.value,
    quantity,
    status,
    confirmationCount: status === "CONFIRMED" ? 1 : 0,
    sourceMessageIds: [],
    rawTranscript: fact.rawTranscript,
  };
}

function dedupeCanonical(facts: CanonicalFact[]): CanonicalFact[] {
  const byId = new Map<string, CanonicalFact>();
  for (const fact of facts) {
    const id = canonicalIdentity(fact.key, fact.processKey);
    const existing = byId.get(id);
    if (!existing) {
      byId.set(id, fact);
      continue;
    }
    byId.set(id, mergeCanonical(existing, fact));
  }
  return [...byId.values()];
}

function mergeCanonical(existing: CanonicalFact, incoming: CanonicalFact): CanonicalFact {
  const same = quantitiesSemanticallyEqual(existing.quantity, incoming.quantity);
  if (existing.status === "CONFIRMED" && incoming.status === "CONFIRMED" && same) {
    return {
      ...existing,
      value: incoming.value || existing.value,
      confirmationCount: existing.confirmationCount + 1,
      sourceMessageIds: uniqueIds([...existing.sourceMessageIds, ...incoming.sourceMessageIds]),
      quantity: mergeQuantity(existing.quantity, incoming.quantity ?? existing.quantity ?? {
        min: null,
        max: null,
        unit: "unknown",
        period: null,
        scope: null,
        stage: null,
        approximate: false,
        uncertain: true,
        raw: incoming.value,
      }),
    };
  }
  if (existing.status === "UNCERTAIN" && incoming.status === "CONFIRMED") {
    return {
      ...incoming,
      confirmationCount: Math.max(1, incoming.confirmationCount),
      sourceMessageIds: uniqueIds([...existing.sourceMessageIds, ...incoming.sourceMessageIds]),
    };
  }
  if (existing.status === "CONFIRMED" && incoming.status === "CONFIRMED" && !same) {
    return {
      ...incoming,
      status: "CONFLICT",
      previousQuantity: existing.quantity,
      confirmationCount: existing.confirmationCount,
      sourceMessageIds: uniqueIds([...existing.sourceMessageIds, ...incoming.sourceMessageIds]),
    };
  }
  if (existing.status === "CONFLICT" && incoming.status === "CONFIRMED") {
    return {
      ...incoming,
      status: "CONFIRMED",
      previousQuantity: existing.previousQuantity ?? existing.quantity,
      confirmationCount: existing.confirmationCount + 1,
      sourceMessageIds: uniqueIds([...existing.sourceMessageIds, ...incoming.sourceMessageIds]),
    };
  }
  return {
    ...existing,
    ...incoming,
    sourceMessageIds: uniqueIds([...existing.sourceMessageIds, ...incoming.sourceMessageIds]),
  };
}

function uniqueIds(ids: string[]) {
  return [...new Set(ids.filter(Boolean))];
}

export function commitCanonicalFact(
  state: InterviewRuntimeState,
  input: FactCommitInput,
): { state: InterviewRuntimeState; fact: CanonicalFact; event: string } {
  const facts = migrateCanonicalFacts(state);
  const processKey = processKeyFromName(input.processName) ?? state.activeProcess;
  const quantity = quantityFromFactText(input.value, input.rawTranscript, state.lastPlan?.questionKey);
  const key = buildFactKey({ category: input.category, quantity });
  const incoming: CanonicalFact = {
    key,
    category: input.category,
    processKey,
    value: input.value,
    quantity,
    status: input.status === "INFERRED" ? "INFERRED" : input.status === "CONFLICT" ? "CONFLICT" : input.status === "UNCERTAIN" ? "UNCERTAIN" : "CONFIRMED",
    confidence: input.confidence,
    confirmationCount: input.status === "CONFIRMED" ? 1 : 0,
    sourceMessageIds: input.sourceMessageId ? [input.sourceMessageId] : [],
    rawTranscript: input.rawTranscript ?? undefined,
  };

  const id = canonicalIdentity(key, processKey);
  const index = facts.findIndex((fact) => canonicalIdentity(fact.key, fact.processKey) === id);
  let event = "FACT_CREATED";
  if (index >= 0) {
    const merged = mergeCanonical(facts[index], incoming);
    if (facts[index].status === "UNCERTAIN" && merged.status === "CONFIRMED") event = "FACT_CONFIRMED";
    else if (merged.status === "CONFLICT") event = "FACT_CONFLICT_DETECTED";
    else event = "FACT_UPDATED";
    facts[index] = merged;
  } else {
    facts.push(incoming);
  }

  const fact = facts[index >= 0 ? index : facts.length - 1];
  const questions = upsertQuestionFromFact(state.questionStates, fact);
  const confirmedFacts = facts.filter((item) => item.status === "CONFIRMED").map(toRuntimeFact);
  const uncertainFacts = facts
    .filter((item) => item.status === "UNCERTAIN" || item.status === "CONFLICT")
    .map(toRuntimeFact);

  return {
    fact,
    event,
    state: {
      ...state,
      canonicalFacts: facts,
      confirmedFacts,
      uncertainFacts,
      questionStates: questions,
      coveredFields: deriveCoveredFields(facts, state.coveredFields),
      activeProcess: processKey || state.activeProcess,
      phase: processKey ? (state.phase === "DISCOVERY" || state.phase === "AWAITING_CONSENT" ? "DEEP_DIVE" : state.phase) : state.phase,
    },
  };
}

function upsertQuestionFromFact(questions: QuestionState[], fact: CanonicalFact): QuestionState[] {
  const next = [...questions];
  const index = next.findIndex((item) => item.key === fact.key);
  const missing = missingQuantitySlots(fact.category, fact.quantity);
  const status: QuestionStatus =
    fact.status === "CONFIRMED" && missing.length === 0
      ? "CONFIRMED"
      : fact.status === "CONFIRMED"
        ? "PARTIAL"
        : fact.status === "CONFLICT"
          ? "ASKED"
          : "PARTIAL";
  const patch: QuestionState = {
    key: fact.key,
    status,
    askedCount: index >= 0 ? next[index].askedCount : 1,
    clarificationCount: index >= 0 ? next[index].clarificationCount : 0,
    answeredByMessageIds: uniqueIds([...(index >= 0 ? next[index].answeredByMessageIds ?? [] : []), ...fact.sourceMessageIds]),
    missingSlots: missing,
  };
  if (index >= 0) next[index] = { ...next[index], ...patch };
  else next.push(patch);
  return next;
}

export function markQuestionPlanned(state: InterviewRuntimeState, plan: NextQuestionPlan): InterviewRuntimeState {
  if (!plan.questionKey || !plan.shouldAsk) {
    return { ...state, lastPlan: plan };
  }
  const questions = [...state.questionStates];
  const index = questions.findIndex((item) => item.key === plan.questionKey);
  const current: QuestionState =
    index >= 0
      ? questions[index]
      : { key: plan.questionKey, status: "ASKED", askedCount: 0, clarificationCount: 0 };
  const updated: QuestionState = {
    ...current,
    status: current.status === "CONFIRMED" ? "CONFIRMED" : "ASKED",
    askedCount: current.askedCount + 1,
    clarificationCount:
      plan.reason === "CLARIFICATION" ? current.clarificationCount + 1 : current.clarificationCount,
    lastAskedAt: new Date().toISOString(),
    missingSlots: plan.missingSlots ?? current.missingSlots,
  };
  if (index >= 0) questions[index] = updated;
  else questions.push(updated);
  return { ...state, questionStates: questions, lastPlan: plan };
}

export function canAskQuestion(state: InterviewRuntimeState, questionKey: string): boolean {
  const fact = migrateCanonicalFacts(state).find((item) => item.key === questionKey);
  if (fact?.status === "CONFLICT") return true;
  if (fact?.status === "CONFIRMED" && missingQuantitySlots(fact.category, fact.quantity).length === 0) {
    return false;
  }
  const question = state.questionStates.find((item) => item.key === questionKey);
  if (question?.status === "CONFIRMED") return false;
  if (question && question.clarificationCount >= MAX_CLARIFICATION_ATTEMPTS && fact?.status === "UNCERTAIN") {
    return false;
  }
  return true;
}

export function syncDerivedRuntimeLists(state: InterviewRuntimeState): InterviewRuntimeState {
  const facts = migrateCanonicalFacts(state);
  return {
    ...state,
    canonicalFacts: facts,
    confirmedFacts: facts.filter((item) => item.status === "CONFIRMED").map(toRuntimeFact),
    uncertainFacts: facts
      .filter((item) => item.status === "UNCERTAIN" || item.status === "CONFLICT")
      .map(toRuntimeFact),
    coveredFields: deriveCoveredFields(facts, state.coveredFields),
  };
}

export function laborFromCanonicalFacts(facts: CanonicalFact[]) {
  const volume = facts.find((fact) => fact.category === "volume" && fact.status === "CONFIRMED");
  const time = facts.find((fact) => fact.category === "time" && fact.status === "CONFIRMED");
  const people = facts.find((fact) => fact.category === "people" && fact.status === "CONFIRMED");
  return {
    weeklyVolumeMin: volume?.quantity?.period === "week" ? volume.quantity.min : null,
    weeklyVolumeMax: volume?.quantity?.period === "week" ? volume.quantity.max : null,
    minutesEachMin: minutesFromTime(time?.quantity ?? null)?.min ?? null,
    minutesEachMax: minutesFromTime(time?.quantity ?? null)?.max ?? null,
    people: people?.quantity?.min ?? people?.quantity?.max ?? null,
    timeStage: time?.quantity?.stage ?? null,
    volumeStage: volume?.quantity?.stage ?? null,
  };
}

function minutesFromTime(quantity: StructuredQuantity | null): { min: number | null; max: number | null } | null {
  if (!quantity) return null;
  const factor = quantity.unit === "hour" ? 60 : quantity.unit === "minute" ? 1 : null;
  if (factor == null) return null;
  return {
    min: quantity.min != null ? quantity.min * factor : null,
    max: quantity.max != null ? quantity.max * factor : null,
  };
}

export function factDisplayLine(fact: CanonicalFact): string {
  const qty = fact.quantity ? quantityToDisplayString(fact.quantity) : fact.value;
  return `${fact.key}: ${qty} [${fact.status}]`;
}
