import Link from "next/link";
import type { InterviewStatus } from "@prisma/client";
import { AnalyzeInterviewButton } from "@/components/admin/InterviewControls";
import { Avatar, ItemCard, ItemCardStat, Pill, ScoreBar, StatusBadge, TableAction } from "@/components/shared";

export type InterviewListItem = {
  id: string;
  status: InterviewStatus;
  durationSeconds: number | null;
  company: { name: string; vertical: string };
  contact: { firstName: string; lastName: string | null; role: string };
  processes: Array<{
    name: string;
    automationScore: number | null;
    opportunity: { scoreTotal: number | null; pilotReadiness: string | null } | null;
  }>;
  _count: { messages: number };
};

function bestProcess(interview: InterviewListItem) {
  return interview.processes
    .slice()
    .sort((a, b) => (b.opportunity?.scoreTotal ?? 0) - (a.opportunity?.scoreTotal ?? 0))[0];
}

export function InterviewItemCard({ interview, detail = false }: { interview: InterviewListItem; detail?: boolean }) {
  const contactName = `${interview.contact.firstName} ${interview.contact.lastName ?? ""}`.trim();
  const top = bestProcess(interview);
  const score = top?.opportunity?.scoreTotal ?? top?.automationScore ?? 0;
  const pilot = top?.opportunity?.pilotReadiness;

  return (
    <ItemCard>
      <div className="flex items-start justify-between gap-3">
        <Link href={`/interviews/${interview.id}`} className="flex min-w-0 items-center gap-3">
          <Avatar name={interview.company.name} />
          <span className="min-w-0">
            <span className="block truncate font-semibold text-foreground">{interview.company.name}</span>
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {contactName} · {interview.contact.role}
            </span>
          </span>
        </Link>
        <StatusBadge status={interview.status} />
      </div>

      <dl className="grid grid-cols-2 gap-3">
        {detail ? <ItemCardStat label="Vertical" value={interview.company.vertical} /> : null}
        {detail ? (
          <ItemCardStat
            label="Duration"
            value={interview.durationSeconds ? `${Math.round(interview.durationSeconds / 60)}m` : "—"}
          />
        ) : null}
        <ItemCardStat label="Turns" value={interview._count.messages} />
        {detail ? <ItemCardStat label="Processes" value={interview.processes.length} /> : null}
        <ItemCardStat
          label="Best score"
          value={score ? <ScoreBar value={score} /> : <span className="text-muted-foreground">—</span>}
        />
        {detail ? (
          <ItemCardStat
            label="Pilot"
            value={
              pilot === "YES" ? (
                <Pill tone="success">Yes</Pill>
              ) : pilot ? (
                <Pill>{pilot}</Pill>
              ) : (
                <span className="text-muted-foreground">—</span>
              )
            }
          />
        ) : null}
      </dl>

      {detail && top ? <p className="truncate text-xs text-muted-foreground">{top.name}</p> : null}

      <div className="flex items-center gap-2 pt-1">
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
    </ItemCard>
  );
}
