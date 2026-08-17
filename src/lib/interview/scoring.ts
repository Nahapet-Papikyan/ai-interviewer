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
