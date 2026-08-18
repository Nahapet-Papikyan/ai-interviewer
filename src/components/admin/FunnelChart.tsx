type Stage = {
  label: string;
  value: number;
};

export function FunnelChart({ stages }: { stages: Stage[] }) {
  const max = Math.max(...stages.map((s) => s.value), 1);

  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-[0_1px_2px_rgb(7_10_18_/_0.04)]">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink">Research funnel</h2>
        <p className="text-xs text-zinc-400">Invitation to analysis</p>
      </div>
      <ol className="mt-5 grid grid-cols-5 gap-2 sm:gap-3">
        {stages.map((stage, index) => {
          const prev = index === 0 ? stage.value : stages[index - 1].value;
          const conversion = prev ? Math.round((stage.value / prev) * 100) : 0;
          const height = Math.max(18, (stage.value / max) * 100);
          return (
            <li key={stage.label} className="flex flex-col">
              <div className="flex h-28 items-end rounded-xl bg-[#f4f7fb] px-3 pb-2 pt-3">
                <div
                  className="w-full rounded-lg bg-gradient-to-t from-brand to-[#4aa3ff]"
                  style={{ height: `${height}%`, opacity: 0.45 + (stage.value / max) * 0.55 }}
                />
              </div>
              <div className="mt-3">
                <div className="text-xl font-semibold tabular-nums tracking-tight text-ink">{stage.value}</div>
                <div className="text-[11px] font-medium text-zinc-600 sm:text-[12px]">{stage.label}</div>
                {index > 0 ? (
                  <div className="mt-0.5 hidden text-[11px] text-zinc-400 sm:block">{conversion}% from previous</div>
                ) : (
                  <div className="mt-0.5 hidden text-[11px] text-zinc-400 sm:block">Starting volume</div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
