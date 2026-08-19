import {
  CRITICAL_FACT_CATEGORIES,
  assessTranscriptQuality,
  isNoiseTranscript,
  looksLikeCriticalNumberUtterance,
} from "@/lib/interview/transcript-quality";
import { parseQuantity } from "@/lib/interview/quantities";
import type { FactStatus, RuntimeFact } from "@/lib/interview/runtime-state";

export type RecordFactInput = {
  category: string;
  value: string;
  processName?: string | null;
  evidenceSummary?: string | null;
  status?: FactStatus;
  rawTranscript?: string | null;
  sourceRole?: "user" | "assistant";
};

export type RecordFactDecision =
  | { record: false; reason: "NOT_CONFIRMED" | "SUSPICIOUS_TRANSCRIPT" | "ASSISTANT_INFERENCE" | "EMPTY" }
  | { record: true; status: FactStatus };

const CONFIRMED_THRESHOLD = 0.75;

export function decideRecordKeyFact(input: RecordFactInput): RecordFactDecision {
  const value = input.value.trim();
  if (!value) return { record: false, reason: "EMPTY" };

  const status = input.status ?? "CONFIRMED";
  if (input.sourceRole === "assistant") {
    return { record: false, reason: "ASSISTANT_INFERENCE" };
  }

  const transcript = input.rawTranscript?.trim() ?? "";
  if (transcript) {
    if (isNoiseTranscript(transcript)) {
      return { record: false, reason: "SUSPICIOUS_TRANSCRIPT" };
    }
    const quality = assessTranscriptQuality(transcript);
    if (quality.needsClarification && CRITICAL_FACT_CATEGORIES.has(input.category)) {
      return { record: false, reason: "SUSPICIOUS_TRANSCRIPT" };
    }
  }

  if (status === "UNCERTAIN") {
    return { record: true, status: "UNCERTAIN" };
  }
  if (status !== "CONFIRMED") {
    return { record: false, reason: "NOT_CONFIRMED" };
  }

  return { record: true, status: "CONFIRMED" };
}

export function isReliableNumericSource(input: {
  status?: FactStatus | string | null;
  confidence?: number | null;
  evidenceType?: "EXPLICIT" | "INFERRED" | "DERIVED" | string | null;
  sourceRole?: string | null;
}): boolean {
  if (input.sourceRole === "assistant") return false;
  if (input.status && input.status !== "CONFIRMED") return false;
  if (input.evidenceType === "INFERRED" || input.evidenceType === "DERIVED") return false;
  if (typeof input.confidence === "number" && input.confidence < CONFIRMED_THRESHOLD) return false;
  return true;
}

/** First numeric token only. Do not use this for volume/time business math. */
export function parseLooseNumber(value: string): number | null {
  const match = value.replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const num = Number(match[0]);
  return Number.isFinite(num) ? num : null;
}

export function laborLooksContradictory(input: {
  weeklyVolume?: number | null;
  minutesEach?: number | null;
  people?: number | null;
}): boolean {
  const volume = input.weeklyVolume;
  const minutes = input.minutesEach;
  const people = input.people;
  if (volume == null || minutes == null || people == null) return false;
  if (volume <= 0 || minutes <= 0 || people <= 0) return false;

  const impliedWeeklyHours = (volume * minutes) / 60;
  const capacityHours = people * 40;
  const ratio = capacityHours / impliedWeeklyHours;
  return ratio >= 3 || ratio <= 1 / 3;
}

export function extractLaborSignals(facts: RuntimeFact[]) {
  let weeklyVolume: number | null = null;
  let minutesEach: number | null = null;
  let people: number | null = null;

  for (const fact of facts) {
    const quantity = fact.quantity ?? parseQuantity(fact.value);
    if (quantity.min == null) continue;
    if (fact.category === "volume" && (quantity.period === "week" || /week|շաբաթ/i.test(fact.value))) {
      weeklyVolume = quantity.min;
    }
    if (fact.category === "time") {
      const n = quantity.min;
      minutesEach =
        quantity.unit === "hour" || (/hour|ժամ/i.test(fact.value) && !/րոպե|min/i.test(fact.value))
          ? n * 60
          : n;
    }
    if (fact.category === "people") people = quantity.min;
  }

  return { weeklyVolume, minutesEach, people };
}

export function confirmedUserFactFromExchange(input: {
  assistantAskedConfirmation: boolean;
  userConfirmed: boolean;
  proposedValue: string;
}): { status: FactStatus; record: boolean } {
  if (input.assistantAskedConfirmation && input.userConfirmed && input.proposedValue.trim()) {
    return { status: "CONFIRMED", record: true };
  }
  return { status: "UNCERTAIN", record: false };
}

export function userSaidYes(text: string): boolean {
  const value = text.trim().toLowerCase();
  return /^(հա|հավա|այո|ոո|ո|yes|yep|yeah|ok|okay|հաստատ|ճիշտ|սա է)$/i.test(value);
}

export function looksLikeUnconfirmedNumberGuess(transcript: string, storedValue: string): boolean {
  const quality = assessTranscriptQuality(transcript);
  if (!quality.suspicious) return false;
  return looksLikeCriticalNumberUtterance(transcript) || Boolean(parseLooseNumber(storedValue));
}
