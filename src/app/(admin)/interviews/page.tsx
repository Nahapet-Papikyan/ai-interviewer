import { InterviewStatus } from "@prisma/client";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { AnalyzeInterviewButton } from "@/components/admin/InterviewControls";
import {
  DataTable,
  EmptyState,
  Eyebrow,
  formatStatus,
  NameCell,
  PageHeader,
  Pill,
  ScoreBar,
  StatusBadge,
  TableAction,
  TableHead,
  TableRow,
  Td,
  Th,
  Truncate,
} from "@/components/admin/ui";

const STATUSES = Object.values(InterviewStatus);

export default async function InterviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; vertical?: string }>;
}) {
  const { status, vertical } = await searchParams;
  const interviews = await prisma.interview.findMany({
    where: {
      status: status && STATUSES.includes(status as InterviewStatus) ? (status as InterviewStatus) : undefined,
      company: vertical ? { vertical: { contains: vertical, mode: "insensitive" } } : undefined,
    },
    include: {
      company: true,
      contact: true,
      processes: { include: { opportunity: true } },
      _count: { select: { messages: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const filtered = Boolean(status || vertical);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={<Eyebrow>Research</Eyebrow>}
        title="Interviews"
        description="Every discovery conversation, with status, transcript length, and best opportunity score."
      />

      <form className="flex flex-wrap items-end gap-3">
        <div className="field min-w-[200px] flex-1">
          <label htmlFor="vertical">Vertical</label>
          <input id="vertical" name="vertical" placeholder="e.g. FMCG" defaultValue={vertical ?? ""} />
        </div>
        <div className="field min-w-[200px]">
          <label htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={status ?? ""}>
            <option value="">All statuses</option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {formatStatus(value)}
              </option>
            ))}
          </select>
        </div>
        <button className="btn-secondary shrink-0" type="submit">
          Filter
        </button>
        {filtered ? (
          <Link href="/interviews" className="inline-flex h-10 items-center text-sm text-zinc-500 hover:text-ink">
            Clear
          </Link>
        ) : null}
      </form>

      {interviews.length === 0 ? (
        <EmptyState
          title={filtered ? "No interviews match these filters" : "No interviews yet"}
          description={filtered ? "Try a different status or vertical." : "Invite a contact to start the first conversation."}
        />
      ) : (
        <DataTable minWidth={1180}>
          <TableHead>
            <Th>Company</Th>
            <Th>Contact</Th>
            <Th>Vertical</Th>
            <Th>Status</Th>
            <Th>Duration</Th>
            <Th>Turns</Th>
            <Th>Processes</Th>
            <Th>Best score</Th>
            <Th>Pilot</Th>
            <Th className="text-right">Actions</Th>
          </TableHead>
          <tbody>
            {interviews.map((interview) => {
              const bestProcess = interview.processes
                .slice()
                .sort((a, b) => (b.opportunity?.scoreTotal ?? 0) - (a.opportunity?.scoreTotal ?? 0))[0];
              const score = bestProcess?.opportunity?.scoreTotal ?? 0;
              const contactName = `${interview.contact.firstName} ${interview.contact.lastName ?? ""}`.trim();
              const pilot = bestProcess?.opportunity?.pilotReadiness;
              return (
                <TableRow key={interview.id}>
                  <Td>
                    <NameCell href={`/interviews/${interview.id}`} name={interview.company.name} />
                  </Td>
                  <Td>
                    <Truncate className="font-medium text-ink" title={contactName}>
                      {contactName}
                    </Truncate>
                    <Truncate className="text-xs text-zinc-400" title={interview.contact.role}>
                      {interview.contact.role}
                    </Truncate>
                  </Td>
                  <Td>
                    <Truncate className="text-zinc-600" title={interview.company.vertical}>
                      {interview.company.vertical}
                    </Truncate>
                  </Td>
                  <Td className="whitespace-nowrap">
                    <StatusBadge status={interview.status} />
                  </Td>
                  <Td className="tabular-nums whitespace-nowrap text-zinc-600">
                    {interview.durationSeconds ? `${Math.round(interview.durationSeconds / 60)}m` : "—"}
                  </Td>
                  <Td className="tabular-nums whitespace-nowrap text-zinc-600">{interview._count.messages}</Td>
                  <Td className="tabular-nums whitespace-nowrap text-zinc-600">{interview.processes.length}</Td>
                  <Td className="min-w-[140px]">
                    {bestProcess ? (
                      <div>
                        <ScoreBar value={score} />
                        <Truncate className="mt-1 text-[11px] text-zinc-400" title={bestProcess.name}>
                          {bestProcess.name}
                        </Truncate>
                      </div>
                    ) : (
                      <span className="text-zinc-300">—</span>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap">
                    {pilot === "YES" ? (
                      <Pill tone="success">Yes</Pill>
                    ) : pilot ? (
                      <Pill>{pilot}</Pill>
                    ) : (
                      <span className="text-zinc-300">—</span>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-right">
                    <div className="inline-flex items-center justify-end gap-2">
                      <TableAction href={`/interviews/${interview.id}${interview._count.messages ? "#transcript" : ""}`}>
                        {interview._count.messages ? "Read chat" : "Open"}
                      </TableAction>
                      <AnalyzeInterviewButton
                        interviewId={interview.id}
                        compact
                        analyzed={interview.processes.length > 0}
                        disabled={!interview._count.messages || interview.status === "ANALYZING"}
                      />
                    </div>
                  </Td>
                </TableRow>
              );
            })}
          </tbody>
        </DataTable>
      )}
    </div>
  );
}
