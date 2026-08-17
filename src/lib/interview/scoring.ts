export type ScoreBreakdown = {
  volume: number;
  manualLabor: number;
  repetitiveness: number;
  digitalInput: number;
  systemAccessibility: number;
  businessImpact: number;
  reusePotential: number;
  pilotReadiness: number;
  penalties: number;
  total: number;
  rationale: string;
};

export const SCORE_CRITERIA = [
  { key: "volume", label: "Volume", max: 20, hint: "Transaction count / month" },
  { key: "manualLabor", label: "Manual labor", max: 20, hint: "Human hours and FTE" },
  { key: "repetitiveness", label: "Repetitiveness", max: 15, hint: "Same steps, same exceptions" },
  { key: "digitalInput", label: "Digital input", max: 10, hint: "Email, Excel, PDF, chat vs paper" },
  { key: "systemAccessibility", label: "System access", max: 10, hint: "1C / ERP / CRM reachability" },
  { key: "businessImpact", label: "Business impact", max: 10, hint: "Time, errors, customers, cash" },
  { key: "reusePotential", label: "Reuse potential", max: 10, hint: "Likely in other companies" },
  { key: "pilotReadiness", label: "Pilot readiness", max: 5, hint: "Data and willingness" },
] as const;

export function clampScore(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function totalFromBreakdown(parts: Omit<ScoreBreakdown, "total" | "rationale">) {
  const raw =
    parts.volume +
    parts.manualLabor +
    parts.repetitiveness +
    parts.digitalInput +
    parts.systemAccessibility +
    parts.businessImpact +
    parts.reusePotential +
    parts.pilotReadiness +
    parts.penalties;
  return clampScore(raw, 0, 100);
}
