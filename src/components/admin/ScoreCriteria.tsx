import { SCORE_CRITERIA } from "@/lib/interview/scoring";

type Props = {
  breakdown: Record<string, unknown>;
  rationale?: string;
};

export function ScoreCriteria({ breakdown, rationale }: Props) {
  const penalties = Number(breakdown.penalties ?? 0);
  const total = Number(breakdown.total ?? 0);

  return (
    <div className="space-y-3">
      {SCORE_CRITERIA.map((criterion) => {
        const value = Number(breakdown[criterion.key] ?? 0);
        const width = Math.max(0, Math.min(100, (value / criterion.max) * 100));
        return (
          <div key={criterion.key}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium">{criterion.label}</span>
              <span className="tabular-nums text-zinc-500">
                {Number.isFinite(value) ? value : "—"} / {criterion.max}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-100">
              <div className="h-full rounded-full bg-zinc-900" style={{ width: `${width}%` }} />
            </div>
            <p className="mt-1 text-xs text-zinc-500">{criterion.hint}</p>
          </div>
        );
      })}
      <div className="flex items-baseline justify-between border-t border-zinc-100 pt-3 text-sm">
        <span className="font-medium">Penalties</span>
        <span className="tabular-nums text-zinc-500">{Number.isFinite(penalties) ? penalties : "—"}</span>
      </div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">Total</span>
        <span className="tabular-nums font-semibold">{Number.isFinite(total) ? Math.round(total) : "—"} / 100</span>
      </div>
      {rationale ? <p className="text-sm leading-6 text-zinc-600">{rationale}</p> : null}
    </div>
  );
}

export function ResearchGates({
  transactionsMonthMax,
  fteMax,
  pilot,
}: {
  transactionsMonthMax: number | null;
  fteMax: number | null;
  pilot: string | null;
}) {
  const volumeHit = (transactionsMonthMax ?? 0) >= 500;
  const fteHit = (fteMax ?? 0) >= 0.5;
  const gates = [
    { label: "≥ 500 tx / month", hit: volumeHit, value: transactionsMonthMax == null ? "unknown" : String(Math.round(transactionsMonthMax)) },
    { label: "≥ 0.5 FTE", hit: fteHit, value: fteMax == null ? "unknown" : fteMax.toFixed(2) },
    { label: "Pilot-ready", hit: pilot === "YES", value: pilot ?? "not asked" },
  ];

  return (
    <ul className="grid gap-2 sm:grid-cols-3">
      {gates.map((gate) => (
        <li
          key={gate.label}
          className={`rounded-xl border px-3 py-2 text-sm ${
            gate.hit ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-zinc-200 bg-zinc-50 text-zinc-600"
          }`}
        >
          <div className="text-xs uppercase tracking-wide opacity-70">{gate.label}</div>
          <div className="mt-1 font-medium">{gate.value}</div>
        </li>
      ))}
    </ul>
  );
}
