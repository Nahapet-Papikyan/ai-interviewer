import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { deleteInterview, markReviewed } from "../../actions";
import { CopyToken, RerunAnalysis } from "@/components/admin/InterviewControls";
import { InterviewChat } from "@/components/admin/InterviewChat";
import { InterviewWorkspace } from "@/components/admin/InterviewWorkspace";
import {
  EvidenceList,
  ProcessFlow,
  ProcessScoreHeader,
  ResearchGates,
  ScoreCriteria,
} from "@/components/admin/ScoreCriteria";
import { Breadcrumb, Button, ButtonAnchor, Card, CardContent, Eyebrow, FormField, PageHeader, Pill, StatusBadge, Surface, TextArea } from "@/components/shared";
import { FTE_HOURS_PER_MONTH } from "@/lib/versions";

export default async function InterviewDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { id } = await params;
  const { token } = await searchParams;
  const interview = await prisma.interview.findUnique({
    where: { id },
    include: {
      company: true,
      contact: true,
      messages: { orderBy: { sequenceNo: "asc" } },
      facts: true,
      analyses: { orderBy: { createdAt: "desc" }, take: 1 },
      processes: {
        include: {
          steps: { orderBy: { stepNo: "asc" } },
          evidence: true,
          systems: true,
          opportunity: true,
        },
      },
    },
  });
  if (!interview) notFound();
  const analysis = interview.analyses[0];
  const raw = analysis?.rawJson as
    | {
        interviewSummary?: {
          keyTakeaway?: string;
          quality?: string;
          respondentKnowledge?: string;
          limitations?: string[];
        };
        followUpQuestions?: string[];
        pilot?: { willingness?: string; dataAvailability?: string; decisionMakers?: string[]; blockers?: string[] };
      }
    | undefined;
  const respondentName = interview.contact.firstName;
  const duration = interview.durationSeconds ? `${Math.round(interview.durationSeconds / 60)} min` : "—";
  const sequenceById = new Map(interview.messages.map((message) => [message.id, message.sequenceNo]));
  const contactName = `${interview.contact.firstName} ${interview.contact.lastName ?? ""}`.trim();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={<Breadcrumb href="/interviews">Interviews</Breadcrumb>}
        title={interview.company.name}
        description={
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={interview.status} />
            <span className="text-zinc-400">·</span>
            <span>
              {contactName} · {interview.contact.role}
            </span>
            <span className="text-zinc-400">·</span>
            <span>{duration}</span>
            <span className="text-zinc-400">·</span>
            <span>{interview.messages.length} turns</span>
          </div>
        }
        actions={
          <>
            <ButtonAnchor href={`/api/interviews/${interview.id}/export`}>Export JSON</ButtonAnchor>
            <ButtonAnchor href={`/api/interviews/${interview.id}/export?format=csv`}>Export CSV</ButtonAnchor>
            <RerunAnalysis
              interviewId={interview.id}
              analyzed={interview.processes.length > 0 || Boolean(analysis)}
              disabled={!interview.messages.length || interview.status === "ANALYZING"}
            />
          </>
        }
      />

      {token ? <CopyToken token={token} /> : null}

      {raw?.interviewSummary ? (
        <Card className="py-5 ring-foreground/8">
          <CardContent>
          <Eyebrow>What happened</Eyebrow>
          <p className="mt-3 text-[15px] leading-7 text-ink">{raw.interviewSummary.keyTakeaway}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {raw.interviewSummary.quality ? <Pill tone="brand">Quality · {raw.interviewSummary.quality}</Pill> : null}
            {raw.interviewSummary.respondentKnowledge ? (
              <Pill>Knowledge · {raw.interviewSummary.respondentKnowledge}</Pill>
            ) : null}
            {interview.analysisVersion ? <Pill>Prompt {interview.analysisVersion}</Pill> : null}
            {interview.schemaVersion ? <Pill>Schema {interview.schemaVersion}</Pill> : null}
          </div>
          {raw.interviewSummary.limitations?.length ? (
            <ul className="mt-4 space-y-1.5 text-sm text-zinc-600">
              {raw.interviewSummary.limitations.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-zinc-400" />
                  {item}
                </li>
              ))}
            </ul>
          ) : null}
          </CardContent>
        </Card>
      ) : (
        <Card className="py-5 ring-foreground/8">
          <CardContent className="text-sm text-muted-foreground">
            {interview.messages.length
              ? "Transcript is saved. Run analysis to score this conversation against the research criteria."
              : "No conversation recorded yet."}
          </CardContent>
        </Card>
      )}

      <InterviewWorkspace
        defaultTab={interview.processes.length || raw?.interviewSummary ? "analysis" : "conversation"}
        analysisLabel={`Analysis${interview.processes.length ? ` · ${interview.processes.length}` : ""}`}
        conversationLabel={`Conversation · ${interview.messages.length}`}
        analysis={
          <div id="analysis" className="space-y-6 scroll-mt-24">
            {interview.processes.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-500">
                {interview.messages.length
                  ? "No analysis yet. Use Analyze on this interview when you want to spend tokens on it."
                  : "No processes extracted yet."}
              </p>
            ) : (
              interview.processes.map((process) => {
                const breakdown = (process.opportunity?.scoreBreakdown ?? {}) as Record<string, unknown>;
                return (
                  <Card key={process.id} className="space-y-5 py-5 ring-foreground/8">
                    <CardContent className="space-y-5">
                    <ProcessScoreHeader
                      name={process.name}
                      description={process.description}
                      clusterTag={process.clusterTag}
                      score={process.opportunity?.scoreTotal ?? 0}
                    />
                    <ResearchGates
                      transactionsMonthMax={process.transactionsMonthMax}
                      fteMax={process.fteMax}
                      pilot={process.opportunity?.pilotReadiness ?? raw?.pilot?.willingness ?? null}
                    />
                    <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                      <Metric
                        label="Tx / month"
                        value={`${process.transactionsMonthMin ?? "?"}–${process.transactionsMonthMax ?? "?"}`}
                      />
                      <Metric
                        label="Hours / month"
                        value={`${process.manualHoursMonthMin?.toFixed?.(1) ?? "?"}–${process.manualHoursMonthMax?.toFixed?.(1) ?? "?"}`}
                      />
                      <Metric
                        label={`FTE (${FTE_HOURS_PER_MONTH}h)`}
                        value={`${process.fteMin?.toFixed?.(2) ?? "?"}–${process.fteMax?.toFixed?.(2) ?? "?"}`}
                      />
                      <Metric
                        label="Confidence"
                        value={process.confidence != null ? `${Math.round(process.confidence * 100)}%` : "—"}
                      />
                    </dl>
                    {process.systems.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {process.systems.map((system) => (
                          <Pill key={system.id}>{system.name}</Pill>
                        ))}
                      </div>
                    ) : null}
                    <ScoreCriteria
                      breakdown={breakdown}
                      rationale={typeof breakdown.rationale === "string" ? breakdown.rationale : undefined}
                    />
                    <ProcessFlow steps={process.steps} />
                    <EvidenceList
                      items={process.evidence.map((ev) => ({
                        id: ev.id,
                        fieldName: ev.fieldName,
                        evidenceType: ev.evidenceType,
                        evidenceText: ev.evidenceText,
                        turn: ev.messageId ? sequenceById.get(ev.messageId) : undefined,
                      }))}
                    />
                    </CardContent>
                  </Card>
                );
              })
            )}

            {raw?.pilot ? (
              <Card className="space-y-3 py-5 text-sm ring-foreground/8">
                <CardContent className="space-y-3">
                <Eyebrow>Pilot</Eyebrow>
                <dl className="grid gap-3 sm:grid-cols-2">
                  <Metric label="Willingness" value={raw.pilot.willingness ?? "—"} />
                  <Metric label="Data" value={raw.pilot.dataAvailability ?? "—"} />
                </dl>
                {raw.pilot.decisionMakers?.length ? (
                  <p className="text-zinc-600">
                    <span className="font-medium text-ink">Decision makers: </span>
                    {raw.pilot.decisionMakers.join(", ")}
                  </p>
                ) : null}
                {raw.pilot.blockers?.length ? (
                  <p className="text-zinc-600">
                    <span className="font-medium text-ink">Blockers: </span>
                    {raw.pilot.blockers.join(", ")}
                  </p>
                ) : null}
                </CardContent>
              </Card>
            ) : null}

            {interview.facts.length ? (
              <Card className="py-5 ring-foreground/8">
                <CardContent>
                <Eyebrow>Recorded facts</Eyebrow>
                <ul className="mt-4 grid gap-2 md:grid-cols-2">
                  {interview.facts.map((fact) => (
                    <li key={fact.id} className="rounded-xl border border-zinc-100 bg-[#f7f9fc] px-3 py-2 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-ink">{fact.category}</span>
                        {fact.status && fact.status !== "CONFIRMED" ? <Pill tone="warn">{fact.status}</Pill> : null}
                        {fact.processName ? <span className="text-xs text-zinc-400">{fact.processName}</span> : null}
                      </div>
                      <p className="mt-1 text-zinc-600">{fact.value}</p>
                    </li>
                  ))}
                </ul>
                </CardContent>
              </Card>
            ) : null}

            {raw?.followUpQuestions?.length ? (
              <Card className="py-5 ring-foreground/8">
                <CardContent>
                <Eyebrow>Follow-up questions</Eyebrow>
                <ol className="mt-4 space-y-2 text-sm">
                  {raw.followUpQuestions.map((q, index) => (
                    <li key={q} className="flex gap-3 rounded-xl border border-zinc-100 bg-[#f7f9fc] px-3 py-2.5">
                      <span className="font-mono text-xs text-brand">{String(index + 1).padStart(2, "0")}</span>
                      <span>{q}</span>
                    </li>
                  ))}
                </ol>
                </CardContent>
              </Card>
            ) : null}
          </div>
        }
        conversation={<InterviewChat messages={interview.messages} respondentName={respondentName} />}
      />

      <form action={markReviewed}>
        <Surface>
          <input type="hidden" name="id" value={interview.id} />
          <Eyebrow>Human review</Eyebrow>
          <FormField label="Notes" htmlFor="reviewNotes">
            <TextArea
              id="reviewNotes"
              name="reviewNotes"
              rows={4}
              defaultValue={interview.reviewNotes ?? ""}
              placeholder="Notes for the research team"
            />
          </FormField>
          <Button type="submit">Mark reviewed</Button>
        </Surface>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-6">
        <p className="text-sm text-zinc-500">
          <Link href={`/companies/${interview.companyId}`} className="hover:text-ink hover:underline">
            Company
          </Link>
          <span className="px-2 text-zinc-300">·</span>
          <Link href={`/contacts/${interview.contactId}`} className="hover:text-ink hover:underline">
            Contact
          </Link>
        </p>
        <form action={deleteInterview}>
          <input type="hidden" name="id" value={interview.id} />
          <Button variant="destructive" type="submit">
            Delete interview data
          </Button>
        </form>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#f7f9fc] px-3 py-2.5">
      <dt className="text-[10px] font-semibold tracking-[0.1em] text-zinc-400 uppercase">{label}</dt>
      <dd className="mt-1 font-medium tabular-nums text-ink">{value}</dd>
    </div>
  );
}
