import { MAX_CLARIFICATION_ATTEMPTS, canAskQuestion, missingQuantitySlots, migrateCanonicalFacts, type NextQuestionPlan } from "@/lib/interview/reasoning-state";
import type { InterviewPhase, InterviewRuntimeState } from "@/lib/interview/runtime-state";

export const DEEP_DIVE_QUESTION_ORDER = [
  {
    key: "volume.first_stage.weekly.whole_team",
    intent: "Ask approximately how many first-stage items the whole team processes per week",
    category: "volume",
  },
  {
    key: "people.first_stage",
    intent: "Ask how many people are usually involved in the first stage",
    category: "people",
  },
  {
    key: "time.first_stage.per_item",
    intent: "Ask how much active working time the first stage usually takes per item",
    category: "time",
  },
  {
    key: "systems.primary_work_system",
    intent: "Ask which system they mainly use to do this work",
    category: "system",
  },
  {
    key: "error.first_stage",
    intent: "Ask what typically goes wrong in the first stage and how often",
    category: "error",
  },
  {
    key: "impact.business",
    intent: "Ask what business consequence those errors or delays have",
    category: "impact",
  },
] as const;

const PILOT_QUESTION = {
  key: "pilot.willingness",
  intent: "Ask whether they would be open to a small follow-up or pilot using real examples",
  category: "pilot",
} as const;

function plan(partial: Partial<NextQuestionPlan> & Pick<NextQuestionPlan, "reason" | "shouldAsk">): NextQuestionPlan {
  return {
    questionKey: partial.questionKey ?? null,
    intent: partial.intent ?? null,
    processKey: partial.processKey,
    missingSlots: partial.missingSlots ?? [],
    reason: partial.reason,
    shouldAsk: partial.shouldAsk,
  };
}

export function planNextQuestion(state: InterviewRuntimeState): NextQuestionPlan {
  const phase: InterviewPhase = state.phase;
  if (state.completed || phase === "COMPLETED" || phase === "CLOSING") {
    return plan({ reason: "COMPLETE", shouldAsk: false });
  }

  const facts = migrateCanonicalFacts(state);
  const conflict = facts.find((fact) => fact.status === "CONFLICT");
  if (conflict) {
    return plan({
      questionKey: conflict.key,
      intent: `Resolve the conflicting values for ${conflict.key} with one concise check`,
      processKey: conflict.processKey,
      reason: "CONFLICT",
      shouldAsk: true,
    });
  }

  const uncertain = facts.find((fact) => {
    if (fact.status !== "UNCERTAIN") return false;
    const question = state.questionStates.find((item) => item.key === fact.key);
    return (question?.clarificationCount ?? 0) < MAX_CLARIFICATION_ATTEMPTS;
  });
  if (uncertain) {
    const question = state.questionStates.find((item) => item.key === uncertain.key);
    const attempt = (question?.clarificationCount ?? 0) + 1;
    return plan({
      questionKey: uncertain.key,
      intent:
        attempt <= 1
          ? `Ask one concise clarification for ${uncertain.key}; do not guess the number`
          : `Ask one final simpler clarification for ${uncertain.key}, then move on if still unclear`,
      processKey: uncertain.processKey,
      missingSlots: missingQuantitySlots(uncertain.category, uncertain.quantity),
      reason: "CLARIFICATION",
      shouldAsk: true,
    });
  }

  const exhaustedUncertain = facts.find((fact) => {
    if (fact.status !== "UNCERTAIN") return false;
    const question = state.questionStates.find((item) => item.key === fact.key);
    return (question?.clarificationCount ?? 0) >= MAX_CLARIFICATION_ATTEMPTS;
  });
  if (exhaustedUncertain) {
    // Fall through to the next missing field; caller logs QUESTION_CLARIFICATION_EXHAUSTED.
  }

  if (phase === "INITIALIZING" || phase === "AWAITING_CONSENT") {
    return plan({ reason: "MISSING_FIELD", shouldAsk: false, intent: null });
  }

  if ((phase === "DISCOVERY" || !state.activeProcess) && !state.activeProcess) {
    return plan({
      questionKey: "workflow.primary_process",
      intent: "Ask what recurring work currently takes the most time for their team",
      reason: "MISSING_FIELD",
      shouldAsk: true,
    });
  }

  for (const question of DEEP_DIVE_QUESTION_ORDER) {
    if (!canAskQuestion(state, question.key)) continue;
    const fact = facts.find((item) => item.key === question.key);
    const missing = fact ? missingQuantitySlots(fact.category, fact.quantity) : ["number"];
    if (fact?.status === "CONFIRMED" && missing.length === 0) continue;
    return plan({
      questionKey: question.key,
      intent: question.intent,
      processKey: state.activeProcess,
      missingSlots: missing,
      reason: "MISSING_FIELD",
      shouldAsk: true,
    });
  }

  if (phase === "PRIORITIZATION") {
    return plan({
      questionKey: "prioritization.most_painful",
      intent: "Ask which of the discussed processes is the most painful or time-consuming",
      reason: "PRIORITIZATION",
      shouldAsk: true,
    });
  }

  if (phase === "PILOT" || canAskQuestion(state, PILOT_QUESTION.key)) {
    if (canAskQuestion(state, PILOT_QUESTION.key) && !facts.some((fact) => fact.key === PILOT_QUESTION.key && fact.status === "CONFIRMED")) {
      return plan({
        questionKey: PILOT_QUESTION.key,
        intent: PILOT_QUESTION.intent,
        reason: "PILOT",
        shouldAsk: true,
      });
    }
  }

  return plan({ reason: "COMPLETE", shouldAsk: false });
}

export function buildPlannerToolResult(planResult: NextQuestionPlan): string {
  if (!planResult.shouldAsk || !planResult.intent) {
    return "Recorded silently. Do not mention this tool. Do not greet. If the interview can close, close briefly; otherwise wait.";
  }
  return [
    "Recorded silently. Do not mention this tool. Do not greet or restart.",
    "Do not produce a filler sentence.",
    "NEXT INTERVIEW INTENT is authoritative. Ask exactly one natural spoken question for:",
    planResult.intent,
    planResult.questionKey ? `questionKey=${planResult.questionKey}` : "",
    "Never re-ask a confirmed semantic question.",
  ]
    .filter(Boolean)
    .join(" ");
}

export function buildClarificationToolResult(planResult: NextQuestionPlan): string {
  return [
    "Do not save this as a confirmed fact.",
    "Do not mention tools or technical details.",
    "NEXT INTERVIEW INTENT is authoritative:",
    planResult.intent ?? "Ask one concise clarification, then continue.",
  ].join(" ");
}
