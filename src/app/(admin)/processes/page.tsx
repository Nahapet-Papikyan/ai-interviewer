import { prisma } from "@/lib/db/prisma";

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export default async function ProcessExplorerPage() {
  const processes = await prisma.process.findMany({
    include: {
      systems: true,
      opportunity: true,
      interview: { include: { company: true } },
    },
  });

  const clusters = new Map<
    string,
    typeof processes
  >();
  for (const process of processes) {
    const key = process.clusterTag || process.name;
    const list = clusters.get(key) ?? [];
    list.push(process);
    clusters.set(key, list);
  }

  const rows = [...clusters.entries()]
    .map(([name, items]) => {
      const companies = new Set(items.map((p) => p.interview.companyId));
      const tx = items
        .map((p) => p.transactionsMonthMax ?? p.transactionsMonthMin)
        .filter((v): v is number => typeof v === "number");
      const hours = items
        .map((p) => p.manualHoursMonthMax ?? p.manualHoursMonthMin)
        .filter((v): v is number => typeof v === "number");
      const with1c = items.filter((p) =>
        p.systems.some((s) => s.name.toLowerCase().includes("1c")),
      ).length;
      const withExcel = items.filter((p) =>
        p.systems.some((s) => /excel|sheets/i.test(s.name)),
      ).length;
      const pilotReady = items.filter((p) => p.opportunity?.pilotReadiness === "YES").length;
      return {
        name,
        companies: companies.size,
        medianTx: median(tx),
        medianHours: median(hours),
        with1c,
        withExcel,
        total: items.length,
        pilotReady,
      };
    })
    .sort((a, b) => b.companies - a.companies);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Process Explorer</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Repeatability across companies — the strategic screen. Cluster tags come from analyzer output and can be corrected later.
        </p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-4 py-2 font-medium">Cluster</th>
              <th className="px-4 py-2 font-medium">Companies</th>
              <th className="px-4 py-2 font-medium">Median tx/month</th>
              <th className="px-4 py-2 font-medium">Median hours/month</th>
              <th className="px-4 py-2 font-medium">1C</th>
              <th className="px-4 py-2 font-medium">Excel</th>
              <th className="px-4 py-2 font-medium">Pilot-ready</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name} className="border-t border-zinc-100">
                <td className="px-4 py-2 font-medium">{row.name}</td>
                <td className="px-4 py-2">{row.companies}</td>
                <td className="px-4 py-2">{row.medianTx != null ? Math.round(row.medianTx) : "—"}</td>
                <td className="px-4 py-2">{row.medianHours != null ? Math.round(row.medianHours) : "—"}</td>
                <td className="px-4 py-2">
                  {row.with1c}/{row.total}
                </td>
                <td className="px-4 py-2">
                  {row.withExcel}/{row.total}
                </td>
                <td className="px-4 py-2">
                  {row.pilotReady}/{row.total}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
