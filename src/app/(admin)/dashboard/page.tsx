import { InterviewStatus } from "@prisma/client";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { FunnelChart } from "@/components/admin/FunnelChart";
import { AnalyzeInterviewButton } from "@/components/admin/InterviewControls";
import {
  ButtonLink,
  DataTable,
  EmptyState,
  Eyebrow,
  NameCell,
  PageHeader,
  ScoreBar,
  StatCard,
  StatusBadge,
  TableAction,
  TableHead,
  TableRow,
  Td,
  Th,
  Truncate,
} from "@/components/shared";

const COMPLETED_STATUSES: InterviewStatus[] = [
  InterviewStatus.COMPLETED,
  InterviewStatus.ANALYZING,
  InterviewStatus.ANALYZED,
  InterviewStatus.REVIEWED,
  InterviewStatus.FOLLOW_UP_READY,
];

const ANALYZED_STATUSES: InterviewStatus[] = [
  InterviewStatus.ANALYZED,
  InterviewStatus.REVIEWED,
  InterviewStatus.FOLLOW_UP_READY,
];

export default async function DashboardPage() {
  const [invited, opened, started, completed, analyzed, interviews] = await Promise.all([
    prisma.interview.count(),
    prisma.interview.count({ where: { openedAt: { not: null } } }),
    prisma.interview.count({ where: { startedAt: { not: null } } }),
    prisma.interview.count({ where: { status: { in: COMPLETED_STATUSES } } }),
    prisma.interview.count({ where: { status: { in: ANALYZED_STATUSES } } }),
    prisma.interview.findMany({
      include: {
        company: true,
        contact: true,
        processes: { include: { opportunity: true } },
        _count: { select: { messages: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  const strong = interviews.filter((i) =>
    i.processes.some((p) => (p.fteMax ?? 0) >= 0.5 || (p.transactionsMonthMax ?? 0) >= 500),
  ).length;
  const pilotReady = interviews.filter((i) =>
    i.processes.some((p) => p.opportunity?.pilotReadiness === "YES"),
  ).length;
  const completionRate = invited ? Math.round((completed / invited) * 100) : 0;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={<Eyebrow>Overview</Eyebrow>}
        title="Research dashboard"
        description="Funnel and recent interviews for the first 20–30 discovery conversations."
      />

      <FunnelChart
        stages={[
          { label: "Invited", value: invited },
          { label: "Opened", value: opened },
          { label: "Started", value: started },
          { label: "Completed", value: completed },
          { label: "Analyzed", value: analyzed },
        ]}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Completion rate" value={`${completionRate}%`} hint="Completed of invited" />
        <StatCard label="Analyzed" value={analyzed} hint="Scored against research criteria" />
        <StatCard label="Strong opportunity" value={strong} hint="≥ 0.5 FTE or ≥ 500 tx / month" />
        <StatCard label="Pilot-ready" value={pilotReady} hint="Willingness confirmed in recent set" />
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Recent interviews</h2>
          <Link href="/interviews" className="text-sm text-zinc-500 transition-colors hover:text-ink">
            View all
          </Link>
        </div>
        {interviews.length === 0 ? (
          <EmptyState
            title="No interviews yet"
            description="Create a contact and send an invitation to start the research funnel."
            action={<ButtonLink href="/contacts">Go to contacts</ButtonLink>}
          />
        ) : (
          <DataTable minWidth={840}>
            <TableHead>
              <Th>Company</Th>
              <Th>Contact</Th>
              <Th>Status</Th>
              <Th>Turns</Th>
              <Th>Best score</Th>
              <Th className="text-right">Actions</Th>
            </TableHead>
            <tbody>
              {interviews.map((interview) => {
                const best = interview.processes
                  .map((p) => p.opportunity?.scoreTotal ?? p.automationScore ?? 0)
                  .reduce((a, b) => Math.max(a, b), 0);
                const contactName = `${interview.contact.firstName} ${interview.contact.lastName ?? ""}`.trim();
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
                    <Td className="whitespace-nowrap">
                      <StatusBadge status={interview.status} />
                    </Td>
                    <Td className="tabular-nums whitespace-nowrap text-zinc-600">{interview._count.messages}</Td>
                    <Td className="min-w-[120px]">{best ? <ScoreBar value={best} /> : <span className="text-zinc-300">—</span>}</Td>
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
      </section>
    </div>
  );
}
