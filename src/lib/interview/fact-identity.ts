import type { StructuredQuantity } from "@/lib/interview/quantities";
import { mergeQuantity, parseQuantity } from "@/lib/interview/quantities";

export const FACT_CATEGORIES = ["volume", "time", "people", "system", "error", "impact", "pilot"] as const;
export type FactCategory = (typeof FACT_CATEGORIES)[number];

export function isFactCategory(value: string): value is FactCategory {
  return (FACT_CATEGORIES as readonly string[]).includes(value);
}

export function processKeyFromName(name?: string | null): string | null {
  if (!name?.trim()) return null;
  const key = name
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  return key || null;
}

export function periodToken(period?: StructuredQuantity["period"]): string {
  if (period === "week") return "weekly";
  if (period === "day") return "daily";
  if (period === "working_day") return "working_day";
  if (period === "month") return "monthly";
  if (period === "item") return "per_item";
  return "unknown_period";
}

export function buildFactKey(input: {
  category: string;
  quantity?: StructuredQuantity | null;
  fallback?: string;
}): string {
  const category = input.category.trim().toLowerCase() || "unknown";
  const quantity = input.quantity;
  const stage = quantity?.stage || "unknown_stage";

  if (category === "volume") {
    return ["volume", stage, periodToken(quantity?.period ?? null), quantity?.scope || "unknown_scope"].join(".");
  }
  if (category === "time") {
    return ["time", stage, periodToken(quantity?.period ?? "item")].join(".");
  }
  if (category === "people") {
    return ["people", stage].join(".");
  }
  if (category === "system") {
    return "systems.primary_work_system";
  }
  if (category === "error") {
    return ["error", stage].join(".");
  }
  if (category === "impact") {
    return "impact.business";
  }
  if (category === "pilot") {
    return input.fallback?.startsWith("pilot.") ? input.fallback : "pilot.willingness";
  }
  return `${category}.${stage}`;
}

export function quantityHintsFromQuestionKey(questionKey?: string | null): Partial<StructuredQuantity> {
  if (!questionKey) return {};
  const parts = questionKey.split(".");
  const hints: Partial<StructuredQuantity> = {};
  if (parts.includes("first_stage")) hints.stage = "first_stage";
  if (parts.includes("second_stage")) hints.stage = "second_stage";
  if (parts.includes("final_stage")) hints.stage = "final_stage";
  if (parts.includes("weekly") || parts.includes("week")) hints.period = "week";
  if (parts.includes("daily") || parts.includes("day")) hints.period = "day";
  if (parts.includes("monthly") || parts.includes("month")) hints.period = "month";
  if (parts.includes("per_item") || parts.includes("item")) hints.period = "item";
  if (parts.includes("whole_team")) hints.scope = "whole_team";
  if (parts.includes("per_person")) hints.scope = "per_person";
  if (parts[0] === "people") hints.unit = "person";
  if (parts[0] === "volume" && !hints.unit) hints.unit = "announcement";
  if (parts[0] === "time") hints.unit = "hour";
  return hints;
}

export function canonicalIdentity(factKey: string, processKey?: string | null): string {
  return `${processKey ?? "_"}::${factKey}`;
}

export function quantityFromFactText(
  value: string,
  rawTranscript?: string | null,
  questionKey?: string | null,
): StructuredQuantity {
  const hints = quantityHintsFromQuestionKey(questionKey);
  const fromValue = parseQuantity(value, hints);
  const fromTranscript = rawTranscript ? parseQuantity(rawTranscript, hints) : null;
  const merged = fromTranscript ? mergeQuantity(fromValue, mergeQuantity(hints, fromTranscript)) : mergeQuantity(hints, fromValue);
  return mergeQuantity(hints, merged);
}
