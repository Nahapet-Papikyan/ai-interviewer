import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { deleteInterview, markReviewed } from "../../actions";
import { CopyToken, RerunAnalysis } from "@/components/admin/InterviewControls";
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
        interviewSummary?: { keyTakeaway?: string; quality?: string; limitations?: string[] };
        followUpQuestions?: string[];
        pilot?: { willingness?: string; dataAvailability?: string };
      }
    | undefined;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{interview.company.name}</h1>
          <p className="text-sm text-zinc-500">
            {interview.contact.firstName} {interview.contact.lastName} · {interview.contact.role} ·{" "}
            {interview.status}
          </p>
        </div>
        <div className="flex gap-2">
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
          <h2 className="font-medium">Analysis summary</h2>
          <p className="mt-2 text-sm">{raw.interviewSummary.keyTakeaway}</p>
          <p className="mt-2 text-xs text-zinc-500">
            Quality {raw.interviewSummary.quality} · prompt {interview.analysisVersion} · schema{" "}
            {interview.schemaVersion}
          </p>
        </div>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Processes</h2>
        {interview.processes.length === 0 ? (
          <p className="text-sm text-zinc-500">No processes extracted yet.</p>
        ) : (
          interview.processes.map((process) => {
            const breakdown = (process.opportunity?.scoreBreakdown ?? {}) as Record<string, unknown>;
            return (
              <article key={process.id} className="card space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-medium">{process.name}</h3>
                    <p className="text-sm text-zinc-500">{process.description}</p>
                  </div>
                  <div className="text-right text-sm">
                    <div className="font-semibold">{Math.round(process.opportunity?.scoreTotal ?? 0)}</div>
                    <div className="text-zinc-500">{process.clusterTag}</div>
                  </div>
                </div>
                <dl className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
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
                    <dt className="text-zinc-500">FTE (assumes {FTE_HOURS_PER_MONTH}h)</dt>
                    <dd>
                      {process.fteMin?.toFixed?.(2) ?? "?"}–{process.fteMax?.toFixed?.(2) ?? "?"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">Pilot</dt>
                    <dd>{process.opportunity?.pilotReadiness ?? "—"}</dd>
                  </div>
                </dl>
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
                <div className="text-xs text-zinc-500">
                  Score breakdown: volume {String(breakdown.volume ?? "—")}, labor{" "}
                  {String(breakdown.manualLabor ?? "—")}, repeat {String(breakdown.repetitiveness ?? "—")},
                  digital {String(breakdown.digitalInput ?? "—")}, systems{" "}
                  {String(breakdown.systemAccessibility ?? "—")}, impact {String(breakdown.businessImpact ?? "—")},
                  reuse {String(breakdown.reusePotential ?? "—")}, pilot {String(breakdown.pilotReadiness ?? "—")},
                  penalties {String(breakdown.penalties ?? "—")}
                </div>
                {process.evidence.length ? (
                  <div>
                    <h4 className="text-sm font-medium">Evidence</h4>
                    <ul className="mt-2 space-y-1 text-sm text-zinc-600">
                      {process.evidence.map((ev) => (
                        <li key={ev.id}>
                          <span className="font-medium">{ev.fieldName}</span> [{ev.evidenceType}]: {ev.evidenceText}
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

      <section className="card">
        <h2 className="font-medium">Transcript</h2>
        <div className="mt-3 space-y-3 text-sm">
          {interview.messages.map((message) => (
            <div key={message.id}>
              <div className="text-xs uppercase tracking-wide text-zinc-400">
                {message.role} · #{message.sequenceNo}
              </div>
              <p className="whitespace-pre-wrap">{message.contentText}</p>
            </div>
          ))}
        </div>
      </section>

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
