import { prisma } from "@/lib/db/prisma";
import {
  DataTable,
  EmptyState,
  Eyebrow,
  ItemCard,
  ItemCardStat,
  PageHeader,
  TableHead,
  TableRow,
  Td,
  Th,
  Truncate,
} from "@/components/shared";

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function ShareBar({ value, total }: { value: number; total: number }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex min-w-[92px] items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
        <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 text-right text-xs tabular-nums text-zinc-500">
        {value}/{total}
      </span>
    </div>
  );
}

export default async function ProcessExplorerPage() {
  const processes = await prisma.process.findMany({
    include: {
      systems: true,
      opportunity: true,
      interview: { include: { company: true } },
    },
  });

  const clusters = new Map<string, typeof processes>();
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
      const with1c = items.filter((p) => p.systems.some((s) => s.name.toLowerCase().includes("1c"))).length;
      const withExcel = items.filter((p) => p.systems.some((s) => /excel|sheets/i.test(s.name))).length;
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

  const maxCompanies = Math.max(...rows.map((r) => r.companies), 1);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={<Eyebrow>Research</Eyebrow>}
        title="Process explorer"
        description="Repeatability across companies — the strategic screen. Cluster tags come from analyzer output and can be corrected later."
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No processes extracted yet"
          description="Run analysis on a completed interview to cluster processes across companies."
        />
      ) : (
        <DataTable
          minWidth={860}
          mobile={rows.map((row) => (
            <ItemCard key={row.name}>
              <p className="font-semibold text-foreground">{row.name}</p>
              <dl className="grid grid-cols-2 gap-3">
                <ItemCardStat
                  label="Companies"
                  value={
                    <span className="flex items-center gap-2">
                      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-full rounded-full bg-ink"
                          style={{ width: `${(row.companies / maxCompanies) * 100}%` }}
                        />
                      </span>
                      {row.companies}
                    </span>
                  }
                />
                <ItemCardStat
                  label="Median tx/month"
                  value={row.medianTx != null ? Math.round(row.medianTx).toLocaleString() : "—"}
                />
                <ItemCardStat
                  label="Median hours/month"
                  value={row.medianHours != null ? Math.round(row.medianHours) : "—"}
                />
                <ItemCardStat label="1C" value={`${row.with1c}/${row.total}`} />
                <ItemCardStat label="Excel" value={`${row.withExcel}/${row.total}`} />
                <ItemCardStat label="Pilot-ready" value={`${row.pilotReady}/${row.total}`} />
              </dl>
            </ItemCard>
          ))}
        >
          <TableHead>
            <Th>Cluster</Th>
            <Th>Companies</Th>
            <Th>Median tx/month</Th>
            <Th>Median hours/month</Th>
            <Th>1C</Th>
            <Th>Excel</Th>
            <Th>Pilot-ready</Th>
          </TableHead>
          <tbody>
            {rows.map((row) => (
              <TableRow key={row.name}>
                <Td>
                  <Truncate className="font-medium" title={row.name}>
                    {row.name}
                  </Truncate>
                </Td>
                <Td>
                  <div className="flex min-w-[120px] items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className="h-full rounded-full bg-ink"
                        style={{ width: `${(row.companies / maxCompanies) * 100}%` }}
                      />
                    </div>
                    <span className="w-5 text-right tabular-nums text-zinc-600">{row.companies}</span>
                  </div>
                </Td>
                <Td className="tabular-nums text-zinc-600">
                  {row.medianTx != null ? Math.round(row.medianTx).toLocaleString() : "—"}
                </Td>
                <Td className="tabular-nums text-zinc-600">
                  {row.medianHours != null ? Math.round(row.medianHours) : "—"}
                </Td>
                <Td>
                  <ShareBar value={row.with1c} total={row.total} />
                </Td>
                <Td>
                  <ShareBar value={row.withExcel} total={row.total} />
                </Td>
                <Td>
                  <ShareBar value={row.pilotReady} total={row.total} />
                </Td>
              </TableRow>
            ))}
          </tbody>
        </DataTable>
      )}
    </div>
  );
}
