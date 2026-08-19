export const QUANTITY_UNITS = [
  "announcement",
  "order",
  "invoice",
  "transaction",
  "person",
  "minute",
  "hour",
  "percent",
  "unknown",
] as const;

export type QuantityUnit = (typeof QUANTITY_UNITS)[number];

export const QUANTITY_PERIODS = ["item", "day", "working_day", "week", "month"] as const;
export type QuantityPeriod = (typeof QUANTITY_PERIODS)[number] | null;

export const QUANTITY_SCOPES = ["whole_team", "per_person", "process", "unknown"] as const;
export type QuantityScope = (typeof QUANTITY_SCOPES)[number] | null;

export type StructuredQuantity = {
  min: number | null;
  max: number | null;
  unit: QuantityUnit;
  period: QuantityPeriod;
  scope: QuantityScope;
  stage: string | null;
  approximate: boolean;
  uncertain: boolean;
  raw: string;
};

const HY_WORDS: Array<[RegExp, number]> = [
  [/մեկուկես/g, 1.5],
  [/երկուկես/g, 2.5],
  [/երեքուկես/g, 3.5],
  [/տասնհինգ/g, 15],
  [/տասներկու/g, 12],
  [/տասնմեկ/g, 11],
  [/տասը/g, 10],
  [/քսան/g, 20],
  [/երեսուն/g, 30],
  [/քառասուն/g, 40],
  [/հիսուն/g, 50],
  [/վաթսուն/g, 60],
  [/յոթանասուն/g, 70],
  [/ութսուն/g, 80],
  [/իննսուն/g, 90],
  [/հարյուր/g, 100],
  [/հինգ/g, 5],
  [/վեց/g, 6],
  [/յոթ/g, 7],
  [/ութ/g, 8],
  [/ինը/g, 9],
  [/չորս/g, 4],
  [/երեք/g, 3],
  [/երկու/g, 2],
  [/(?<!ու)մեկ(?!ուկես)/g, 1],
];

const AMBIGUOUS_HALF = /մեկ\s+կես/;

function emptyQuantity(raw: string, uncertain = false): StructuredQuantity {
  return {
    min: null,
    max: null,
    unit: "unknown",
    period: null,
    scope: null,
    stage: null,
    approximate: /մոտ|մոտավոր|around|about|approximately|≈|~/i.test(raw),
    uncertain,
    raw,
  };
}

export function normalizeArmenianNumerals(text: string): { text: string; uncertain: boolean } {
  const uncertain = AMBIGUOUS_HALF.test(text);
  let next = text;
  if (uncertain) {
    next = next.replace(AMBIGUOUS_HALF, " ");
  }
  for (const [pattern, value] of HY_WORDS) {
    next = next.replace(pattern, String(value));
  }
  next = next.replace(/(?<![ա-ֆ])կես(?![ա-ֆ])/g, "0.5");
  return { text: next, uncertain };
}

function detectUnit(text: string): QuantityUnit {
  if (/հայտարար|announcement/i.test(text)) return "announcement";
  if (/պատվեր|order/i.test(text)) return "order";
  if (/հաշիվ|invoice/i.test(text)) return "invoice";
  if (/գործարք|transaction/i.test(text)) return "transaction";
  if (/մարդ|հոգի|աշխատակից|people|person|employee/i.test(text)) return "person";
  if (/րոպե|minute|\bmin\b/i.test(text)) return "minute";
  if (/ժամ|hour|\bhr\b/i.test(text)) return "hour";
  if (/%|տոկոս|percent/i.test(text)) return "percent";
  return "unknown";
}

function detectPeriod(text: string): QuantityPeriod {
  if (/յուրաքանչյուր հայտարար|per (announcement|item|order|transaction)|\/\s*item/i.test(text)) {
    return "item";
  }
  if (/աշխատանքային\s+օր|working\s+day/i.test(text)) return "working_day";
  if (/շաբաթ|weekly|\bweek\b/i.test(text)) return "week";
  if (/ամիս|monthly|\bmonth\b/i.test(text)) return "month";
  if (/օրական|daily|\bday\b|\/\s*day/i.test(text)) return "day";
  if (/հայտարարություն|announcement|պատվեր|item/i.test(text) && /ժամ|hour|րոպե|min/i.test(text)) {
    return "item";
  }
  return null;
}

function detectScope(text: string): QuantityScope {
  if (/ամբողջ\s+թիմ|whole\s+team|entire\s+team|all\s+team/i.test(text)) return "whole_team";
  if (/մեկ\s+աշխատ|մեկ\s+մարդ|per\s+person|one\s+employee|յուրաքանչյուր\s+աշխատ/i.test(text)) {
    return "per_person";
  }
  return null;
}

function detectStage(text: string): string | null {
  if (/առաջին\s+փուլ|first\s+stage|stage\s*1/i.test(text)) return "first_stage";
  if (/երկրորդ\s+փուլ|second\s+stage|stage\s*2/i.test(text)) return "second_stage";
  if (/վերջին\s+փուլ|last\s+stage|final\s+stage/i.test(text)) return "final_stage";
  return null;
}

function parseNumericTokens(text: string): number[] {
  const matches = text.match(/-?\d+(?:[.,]\d+)?/g) ?? [];
  return matches
    .map((token) => Number(token.replace(",", ".")))
    .filter((value) => Number.isFinite(value));
}

export function parseNumericRange(text: string): { min: number | null; max: number | null; uncertain: boolean } {
  const normalized = normalizeArmenianNumerals(text);
  const source = normalized.text.replace(/[–—]/g, "-");

  const fromRange =
    source.match(/(-?\d+(?:[.,]\d+)?)\s*(?:-|ից|to)\s*(-?\d+(?:[.,]\d+)?)/i) ??
    source.match(/(-?\d+(?:[.,]\d+)?)\s*[-–]\s*(-?\d+(?:[.,]\d+)?)/);
  if (fromRange) {
    const min = Number(fromRange[1].replace(",", "."));
    const max = Number(fromRange[2].replace(",", "."));
    if (Number.isFinite(min) && Number.isFinite(max)) {
      return { min: Math.min(min, max), max: Math.max(min, max), uncertain: normalized.uncertain };
    }
  }

  const numbers = parseNumericTokens(source);
  if (numbers.length === 0) {
    return { min: null, max: null, uncertain: true };
  }
  if (numbers.length === 1) {
    return { min: numbers[0], max: numbers[0], uncertain: normalized.uncertain };
  }
  return {
    min: Math.min(numbers[0], numbers[1]),
    max: Math.max(numbers[0], numbers[1]),
    uncertain: normalized.uncertain,
  };
}

export function parseQuantity(text: string, hints: Partial<StructuredQuantity> = {}): StructuredQuantity {
  const raw = text.trim();
  if (!raw) return { ...emptyQuantity(""), uncertain: true, ...hints };

  if (AMBIGUOUS_HALF.test(raw) && !/մեկուկես/.test(raw)) {
    return {
      ...emptyQuantity(raw, true),
      unit: hints.unit ?? detectUnit(raw),
      period: hints.period ?? detectPeriod(raw),
      scope: hints.scope ?? detectScope(raw),
      stage: hints.stage ?? detectStage(raw),
    };
  }

  const range = parseNumericRange(raw);
  return {
    min: range.min,
    max: range.max,
    unit: hints.unit ?? detectUnit(raw),
    period: hints.period ?? detectPeriod(raw),
    scope: hints.scope ?? detectScope(raw) ?? null,
    stage: hints.stage ?? detectStage(raw),
    approximate: /մոտ|մոտավոր|around|about|approximately|≈|~/i.test(raw),
    uncertain: range.uncertain || (range.min == null && range.max == null),
    raw,
  };
}

export function mergeQuantity(
  base: Partial<StructuredQuantity> | null | undefined,
  incoming: StructuredQuantity,
): StructuredQuantity {
  return {
    min: incoming.min ?? base?.min ?? null,
    max: incoming.max ?? base?.max ?? null,
    unit: incoming.unit !== "unknown" ? incoming.unit : (base?.unit ?? "unknown"),
    period: incoming.period ?? base?.period ?? null,
    scope: incoming.scope && incoming.scope !== "unknown" ? incoming.scope : (base?.scope ?? incoming.scope),
    stage: incoming.stage ?? base?.stage ?? null,
    approximate: incoming.approximate || Boolean(base?.approximate),
    uncertain: incoming.uncertain,
    raw: incoming.raw || base?.raw || "",
  };
}

export function quantitiesSemanticallyEqual(
  a?: StructuredQuantity | null,
  b?: StructuredQuantity | null,
): boolean {
  if (!a || !b) return false;
  if (a.min !== b.min || a.max !== b.max) return false;
  if (a.min == null && a.max == null) return false;
  const unitOk = a.unit === "unknown" || b.unit === "unknown" || a.unit === b.unit;
  const periodOk = !a.period || !b.period || a.period === b.period;
  const scopeOk =
    !a.scope || !b.scope || a.scope === "unknown" || b.scope === "unknown" || a.scope === b.scope;
  const stageOk = !a.stage || !b.stage || a.stage === b.stage;
  return unitOk && periodOk && scopeOk && stageOk;
}

export function quantityToDisplayString(quantity: StructuredQuantity): string {
  if (quantity.min == null && quantity.max == null) return quantity.raw || "unknown";
  const numbers =
    quantity.min === quantity.max || quantity.max == null
      ? String(quantity.min)
      : `${quantity.min}–${quantity.max}`;
  const unit = quantity.unit === "unknown" ? "" : ` ${quantity.unit}${quantity.max != null && quantity.max !== 1 ? "s" : ""}`;
  const period = quantity.period && quantity.period !== "item" ? `/${quantity.period}` : quantity.period === "item" ? "/item" : "";
  const scope = quantity.scope && quantity.scope !== "unknown" ? ` (${quantity.scope})` : "";
  const stage = quantity.stage ? ` [${quantity.stage}]` : "";
  return `${numbers}${unit}${period}${scope}${stage}`.trim();
}

export function quantityHasCoreNumber(quantity?: StructuredQuantity | null): boolean {
  return Boolean(quantity && (quantity.min != null || quantity.max != null) && !quantity.uncertain);
}
