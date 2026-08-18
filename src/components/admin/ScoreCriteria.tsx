import { SCORE_CRITERIA } from "@/lib/interview/scoring";
import { ButtonAnchor, Checkbox, Pill, ScoreRing, scoreTone } from "@/components/shared";

type Props = {
  breakdown: Record<string, unknown>;
  rationale?: string;
};

export function ScoreRadar({ breakdown }: { breakdown: Record<string, unknown> }) {
  const cx = 120;
  const cy = 120;
  const maxR = 78;
  const n = SCORE_CRITERIA.length;
  const points = SCORE_CRITERIA.map((criterion, i) => {
    const value = Number(breakdown[criterion.key] ?? 0);
    const pct = Math.max(0, Math.min(1, value / criterion.max));
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return {
      x: cx + Math.cos(angle) * maxR * pct,
      y: cy + Math.sin(angle) * maxR * pct,
      lx: cx + Math.cos(angle) * (maxR + 18),
      ly: cy + Math.sin(angle) * (maxR + 16),
      label: criterion.label.split(" ")[0],
    };
  });
  const rings = [0.33, 0.66, 1];

  return (
    <svg viewBox="0 0 240 240" className="mx-auto h-[240px] w-[240px]">
      {rings.map((ring) => (
        <polygon
          key={ring}
          fill="none"
          stroke="#e8edf5"
          strokeWidth="1"
          points={SCORE_CRITERIA.map((_, i) => {
            const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
            return `${cx + Math.cos(angle) * maxR * ring},${cy + Math.sin(angle) * maxR * ring}`;
          }).join(" ")}
        />
      ))}
      {SCORE_CRITERIA.map((_, i) => {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={cx + Math.cos(angle) * maxR}
            y2={cy + Math.sin(angle) * maxR}
            stroke="#e8edf5"
            strokeWidth="1"
          />
        );
      })}
      <polygon
        points={points.map((p) => `${p.x},${p.y}`).join(" ")}
        fill="rgb(22 135 248 / 0.16)"
        stroke="#1687f8"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {points.map((p) => (
        <g key={p.label}>
          <circle cx={p.x} cy={p.y} r="2.5" fill="#1687f8" />
          <text x={p.lx} y={p.ly} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="#9da8ba">
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function ScoreCriteria({ breakdown, rationale }: Props) {
  const penalties = Number(breakdown.penalties ?? 0);
  const total = Number(breakdown.total ?? 0);

  return (
    <div className="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start">
      <ScoreRadar breakdown={breakdown} />
      <div className="space-y-4">
        <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {SCORE_CRITERIA.map((criterion) => {
            const value = Number(breakdown[criterion.key] ?? 0);
            const width = Math.max(0, Math.min(100, (value / criterion.max) * 100));
            const tone = scoreTone(value, criterion.max);
            return (
              <div key={criterion.key}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium text-ink">{criterion.label}</span>
                  <span className={`tabular-nums text-xs ${tone.text}`}>
                    {Number.isFinite(value) ? value : "—"} / {criterion.max}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                  <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${width}%` }} />
                </div>
                <p className="mt-1 text-[11px] text-zinc-400">{criterion.hint}</p>
              </div>
            );
          })}
        </div>
        <div className="flex items-baseline justify-between border-t border-zinc-100 pt-3 text-sm">
          <span className="text-zinc-500">Penalties</span>
          <span className="tabular-nums text-zinc-600">{Number.isFinite(penalties) ? penalties : "—"}</span>
        </div>
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-medium">Total</span>
          <span className="tabular-nums font-semibold">{Number.isFinite(total) ? Math.round(total) : "—"} / 100</span>
        </div>
        {rationale ? <p className="text-sm leading-6 text-zinc-600">{rationale}</p> : null}
      </div>
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
          className={`rounded-xl border px-3 py-2.5 text-sm ${
            gate.hit
              ? "border-emerald-200/80 bg-emerald-50 text-emerald-900"
              : "border-zinc-200 bg-zinc-50 text-zinc-600"
          }`}
        >
          <div className="flex items-center gap-2">
            <Checkbox checked={gate.hit} readOnly aria-label={gate.label} />
            <div className="text-[10px] font-semibold tracking-[0.1em] uppercase opacity-70">{gate.label}</div>
          </div>
          <div className="mt-1 font-medium">{gate.value}</div>
        </li>
      ))}
    </ul>
  );
}

export function ProcessFlow({
  steps,
}: {
  steps: { id: string; actor: string | null; action: string; system: string | null; manual: boolean | null }[];
}) {
  if (!steps.length) return null;
  return (
    <div>
      <h4 className="text-sm font-semibold text-ink">Process flow</h4>
      <ol className="mt-3">
        {steps.map((step, index) => (
          <li key={step.id} className="flex gap-3">
            <div className="flex w-7 shrink-0 flex-col items-center">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-[11px] font-semibold text-white">
                {index + 1}
              </span>
              {index < steps.length - 1 ? <span className="w-px flex-1 bg-zinc-200" /> : null}
            </div>
            <div className={`min-w-0 flex-1 ${index < steps.length - 1 ? "pb-4" : ""}`}>
              {step.actor ? (
                <p className="text-[11px] font-medium tracking-wide text-zinc-400">{step.actor}</p>
              ) : null}
              <p className="text-sm font-medium text-ink">{step.action}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {step.system ? <Pill>{step.system}</Pill> : null}
                {step.manual ? <Pill tone="warn">Manual</Pill> : null}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function formatEvidenceField(field: string) {
  return field
    .split(" / ")
    .map((part) => {
      const last = part.split(".").pop() ?? part;
      return last
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/_/g, " ")
        .replace(/^\w/, (char) => char.toUpperCase());
    })
    .join(" · ");
}

export function EvidenceList({
  items,
}: {
  items: {
    id: string;
    fieldName: string;
    evidenceType: string;
    evidenceText: string;
    turn?: number;
  }[];
}) {
  if (!items.length) return null;
  return (
    <div>
      <h4 className="text-sm font-semibold text-ink">Evidence from chat</h4>
      <ul className="mt-3 grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <li key={item.id} className="flex h-full flex-col rounded-xl border border-zinc-100 bg-[#f7f9fc] p-3.5">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 truncate text-sm font-medium text-ink" title={item.fieldName}>
                {formatEvidenceField(item.fieldName)}
              </p>
              <Pill
                tone={
                  item.evidenceType === "EXPLICIT" ? "success" : item.evidenceType === "DERIVED" ? "warn" : "neutral"
                }
              >
                {item.evidenceType}
              </Pill>
            </div>
            <p className="mt-2 flex-1 text-sm leading-6 text-zinc-600">“{item.evidenceText}”</p>
            {item.turn ? (
              <ButtonAnchor
                href={`#m-${item.turn}`}
                variant="outline"
                size="sm"
                className="mt-3 h-auto py-1 text-xs text-brand hover:text-brand"
              >
                Jump to turn #{item.turn}
              </ButtonAnchor>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ProcessScoreHeader({
  name,
  description,
  clusterTag,
  score,
}: {
  name: string;
  description: string | null;
  clusterTag: string | null;
  score: number;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h3 className="text-base font-semibold tracking-tight text-ink">{name}</h3>
        {description ? <p className="mt-1 text-sm leading-6 text-zinc-500">{description}</p> : null}
        {clusterTag ? (
          <p className="mt-2 text-[11px] font-semibold tracking-[0.12em] text-brand uppercase">{clusterTag}</p>
        ) : null}
      </div>
      <ScoreRing value={score} label="score" />
    </div>
  );
}
