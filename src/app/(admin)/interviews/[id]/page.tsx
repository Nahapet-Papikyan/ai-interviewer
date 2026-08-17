import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { deleteInterview, markReviewed } from "../../actions";
import { CopyToken, RerunAnalysis } from "@/components/admin/InterviewControls";
import { InterviewChat } from "@/components/admin/InterviewChat";
import { ResearchGates, ScoreCriteria } from "@/components/admin/ScoreCriteria";
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

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500">
            <Link href="/interviews" className="hover:underline">
              Interviews
            </Link>
          </p>
          <h1 className="mt-1 text-2xl font-semibold">{interview.company.name}</h1>
          <p className="text-sm text-zinc-500">
            {respondentName} {interview.contact.lastName} · {interview.contact.role} · {interview.status} · {duration} ·{" "}
            {interview.messages.length} turns
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className="btn-secondary" href="#transcript">
            Read chat
          </a>
          <a className="btn-secondary" href="#analysis">
            Analysis
          </a>
          <a className="btn-secondary" href={`/api/interviews/${interview.id}/export`}>
            Export JSON
          </a>
          <a className="btn-secondary" href={`/api/interviews/${interview.id}/export?format=csv`}>
            Export CSV
          </a>
          <RerunAnalysis interviewId={interview.id} />
        </div>
      </div>

      {token ? <CopyToken token={token} /> : null}

      {raw?.interviewSummary ? (
        <div className="card">
          <h2 className="font-medium">What happened</h2>
          <p className="mt-2 text-sm leading-6">{raw.interviewSummary.keyTakeaway}</p>
          <p className="mt-2 text-xs text-zinc-500">
            Quality {raw.interviewSummary.quality} · knowledge {raw.interviewSummary.respondentKnowledge} · prompt{" "}
            {interview.analysisVersion} · schema {interview.schemaVersion}
          </p>
          {raw.interviewSummary.limitations?.length ? (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-600">
              {raw.interviewSummary.limitations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <div className="card text-sm text-zinc-500">
          {interview.messages.length
            ? "Transcript is saved. Run analysis to score this conversation against the research criteria."
            : "No conversation recorded yet."}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <InterviewChat messages={interview.messages} respondentName={respondentName} />

        <div id="analysis" className="space-y-6 scroll-mt-24">
          <section className="space-y-3">
            <h2 className="text-lg font-medium">Analysis by criteria</h2>
            {interview.processes.length === 0 ? (
              <p className="text-sm text-zinc-500">No processes extracted yet.</p>
            ) : (
              interview.processes.map((process) => {
                const breakdown = (process.opportunity?.scoreBreakdown ?? {}) as Record<string, unknown>;
                return (
                  <article key={process.id} className="card space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-medium">{process.name}</h3>
                        <p className="text-sm text-zinc-500">{process.description}</p>
                      </div>
                      <div className="text-right text-sm">
                        <div className="text-2xl font-semibold">{Math.round(process.opportunity?.scoreTotal ?? 0)}</div>
                        <div className="text-zinc-500">{process.clusterTag}</div>
                      </div>
                    </div>
                    <ResearchGates
                      transactionsMonthMax={process.transactionsMonthMax}
                      fteMax={process.fteMax}
                      pilot={process.opportunity?.pilotReadiness ?? raw?.pilot?.willingness ?? null}
                    />
                    <dl className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <dt className="text-zinc-500">Tx / month</dt>
                        <dd>
                          {process.transactionsMonthMin ?? "?"}–{process.transactionsMonthMax ?? "?"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-zinc-500">Hours / month</dt>
                        <dd>
                          {process.manualHoursMonthMin?.toFixed?.(1) ?? "?"}–{process.manualHoursMonthMax?.toFixed?.(1) ?? "?"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-zinc-500">FTE ({FTE_HOURS_PER_MONTH}h)</dt>
                        <dd>
                          {process.fteMin?.toFixed?.(2) ?? "?"}–{process.fteMax?.toFixed?.(2) ?? "?"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-zinc-500">Confidence</dt>
                        <dd>{process.confidence != null ? `${Math.round(process.confidence * 100)}%` : "—"}</dd>
                      </div>
                    </dl>
                    <ScoreCriteria
                      breakdown={breakdown}
                      rationale={typeof breakdown.rationale === "string" ? breakdown.rationale : undefined}
                    />
                    {process.steps.length ? (
                      <ol className="list-decimal space-y-1 pl-5 text-sm">
                        {process.steps.map((step) => (
                          <li key={step.id}>
                            {step.actor ? `${step.actor}: ` : ""}
                            {step.action}
                            {step.system ? ` (${step.system})` : ""}
                            {step.manual ? " — manual" : ""}
                          </li>
                        ))}
                      </ol>
                    ) : null}
                    {process.evidence.length ? (
                      <div>
                        <h4 className="text-sm font-medium">Evidence from chat</h4>
                        <ul className="mt-2 space-y-1 text-sm text-zinc-600">
                          {process.evidence.map((ev) => (
                            <li key={ev.id}>
                              <span className="font-medium">{ev.fieldName}</span> [{ev.evidenceType}]: {ev.evidenceText}{" "}
                              {ev.messageId && sequenceById.get(ev.messageId) ? (
                                <a className="text-zinc-500 hover:underline" href={`#m-${sequenceById.get(ev.messageId)}`}>
                                  jump to #{sequenceById.get(ev.messageId)}
                                </a>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </article>
                );
              })
            )}
          </section>

          {raw?.pilot ? (
            <section className="card space-y-2 text-sm">
              <h2 className="font-medium">Pilot</h2>
              <p>Willingness: {raw.pilot.willingness ?? "—"}</p>
              <p>Data: {raw.pilot.dataAvailability ?? "—"}</p>
              {raw.pilot.decisionMakers?.length ? <p>Decision makers: {raw.pilot.decisionMakers.join(", ")}</p> : null}
              {raw.pilot.blockers?.length ? <p>Blockers: {raw.pilot.blockers.join(", ")}</p> : null}
            </section>
          ) : null}

          {interview.facts.length ? (
            <section className="card">
              <h2 className="font-medium">Recorded facts</h2>
              <ul className="mt-2 space-y-1 text-sm text-zinc-600">
                {interview.facts.map((fact) => (
                  <li key={fact.id}>
                    <span className="font-medium">{fact.category}</span>: {fact.value}
                    {fact.processName ? ` (${fact.processName})` : ""}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {raw?.followUpQuestions?.length ? (
            <section className="card">
              <h2 className="font-medium">Follow-up questions</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {raw.followUpQuestions.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>

      <form action={markReviewed} className="card space-y-3">
        <input type="hidden" name="id" value={interview.id} />
        <h2 className="font-medium">Human review</h2>
        <textarea name="reviewNotes" rows={4} defaultValue={interview.reviewNotes ?? ""} />
        <button className="btn" type="submit">
          Mark reviewed
        </button>
      </form>

      <form action={deleteInterview}>
        <input type="hidden" name="id" value={interview.id} />
        <button className="text-sm text-red-600" type="submit">
          Delete interview data
        </button>
      </form>

      <p className="text-sm text-zinc-500">
        <Link href={`/companies/${interview.companyId}`} className="hover:underline">
          Company
        </Link>{" "}
        ·{" "}
        <Link href={`/contacts/${interview.contactId}`} className="hover:underline">
          Contact
        </Link>
      </p>
    </div>
  );
}
