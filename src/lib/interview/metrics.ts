import {
  FTE_HOURS_PER_MONTH,
  WEEKS_PER_MONTH,
  WORKING_DAYS_PER_MONTH,
} from "@/lib/versions";

export type Range = {
  min: number | null;
  max: number | null;
  pointEstimate: number | null;
};

export function rangeFromMinMax(min?: number | null, max?: number | null): Range {
  const hasMin = typeof min === "number";
  const hasMax = typeof max === "number";
  if (!hasMin && !hasMax) {
    return { min: null, max: null, pointEstimate: null };
  }
  const lo = hasMin ? min! : max!;
  const hi = hasMax ? max! : min!;
  return {
    min: lo,
    max: hi,
    pointEstimate: (lo + hi) / 2,
  };
}

export function deriveMonthlyTransactions(input: {
  perDayMin?: number | null;
  perDayMax?: number | null;
  perMonthMin?: number | null;
  perMonthMax?: number | null;
  weeklyMin?: number | null;
  weeklyMax?: number | null;
}) {
  const assumptions: string[] = [];
  if (input.perMonthMin != null || input.perMonthMax != null) {
    return {
      ...rangeFromMinMax(input.perMonthMin, input.perMonthMax),
      assumptions,
      basis: "EXPLICIT" as const,
    };
  }
  if (input.perDayMin != null || input.perDayMax != null) {
    const day = rangeFromMinMax(input.perDayMin, input.perDayMax);
    assumptions.push(`${WORKING_DAYS_PER_MONTH} working days/month`);
    return {
      min: day.min != null ? day.min * WORKING_DAYS_PER_MONTH : null,
      max: day.max != null ? day.max * WORKING_DAYS_PER_MONTH : null,
      pointEstimate:
        day.pointEstimate != null ? day.pointEstimate * WORKING_DAYS_PER_MONTH : null,
      assumptions,
      basis: "DERIVED" as const,
    };
  }
  if (input.weeklyMin != null || input.weeklyMax != null) {
    const week = rangeFromMinMax(input.weeklyMin, input.weeklyMax);
    assumptions.push(`${WEEKS_PER_MONTH} weeks/month`);
    return {
      min: week.min != null ? week.min * WEEKS_PER_MONTH : null,
      max: week.max != null ? week.max * WEEKS_PER_MONTH : null,
      pointEstimate:
        week.pointEstimate != null ? week.pointEstimate * WEEKS_PER_MONTH : null,
      assumptions,
      basis: "DERIVED" as const,
    };
  }
  return { min: null, max: null, pointEstimate: null, assumptions, basis: "UNKNOWN" as const };
}

export function deriveLabor(input: {
  monthlyTransactionsMin?: number | null;
  monthlyTransactionsMax?: number | null;
  minutesPerTransactionMin?: number | null;
  minutesPerTransactionMax?: number | null;
  manualHoursMonthMin?: number | null;
  manualHoursMonthMax?: number | null;
}) {
  const assumptions: string[] = [];
  let hours = rangeFromMinMax(input.manualHoursMonthMin, input.manualHoursMonthMax);
  if (hours.min == null && hours.max == null) {
    const tx = rangeFromMinMax(input.monthlyTransactionsMin, input.monthlyTransactionsMax);
    const minutes = rangeFromMinMax(
      input.minutesPerTransactionMin,
      input.minutesPerTransactionMax,
    );
    if (tx.min != null && minutes.min != null) {
      hours = {
        min: (tx.min * minutes.min) / 60,
        max: ((tx.max ?? tx.min) * (minutes.max ?? minutes.min)) / 60,
        pointEstimate: ((tx.pointEstimate ?? tx.min) * (minutes.pointEstimate ?? minutes.min)) / 60,
      };
      assumptions.push("manual_hours_month = monthly_transactions * minutes_per_transaction / 60");
    }
  }

  let fte: Range = { min: null, max: null, pointEstimate: null };
  if (hours.min != null || hours.max != null) {
    assumptions.push(`FTE hours/month = ${FTE_HOURS_PER_MONTH} (configurable assumption)`);
    fte = {
      min: hours.min != null ? hours.min / FTE_HOURS_PER_MONTH : null,
      max: hours.max != null ? hours.max / FTE_HOURS_PER_MONTH : null,
      pointEstimate:
        hours.pointEstimate != null ? hours.pointEstimate / FTE_HOURS_PER_MONTH : null,
    };
  }

  return { hours, fte, assumptions };
}
