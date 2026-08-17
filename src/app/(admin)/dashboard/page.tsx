import { InterviewStatus } from "@prisma/client";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";

export default async function DashboardPage() {
  const [invited, opened, started, completed, analyzed, interviews] = await Promise.all([
    prisma.interview.count(),
    prisma.interview.count({ where: { openedAt: { not: null } } }),
    prisma.interview.count({ where: { startedAt: { not: null } } }),
    prisma.interview.count({ where: { status: { in: [InterviewStatus.COMPLETED, InterviewStatus.ANALYZING, InterviewStatus.ANALYZED, InterviewStatus.REVIEWED, InterviewStatus.FOLLOW_UP_READY] } } }),
    prisma.interview.count({ where: { status: { in: [InterviewStatus.ANALYZED, InterviewStatus.REVIEWED, InterviewStatus.FOLLOW_UP_READY] } } }),
    prisma.interview.findMany({
      include: {
        company: true,
        contact: true,
        processes: { include: { opportunity: true } },
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

  const cards = [
    ["Invitations", invited],
    ["Opened", opened],
    ["Started", started],
    ["Completed", completed],
    ["Completion rate", `${completionRate}%`],
    ["Analyzed", analyzed],
    ["Strong opportunity", strong],
    ["Pilot-ready", pilotReady],
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Overview</h1>
        <p className="mt-1 text-sm text-zinc-500">Research funnel for the first 20–30 interviews.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map(([label, value]) => (
          <div key={label} className="card">
            <div className="text-2xl font-semibold">{value}</div>
            <div className="mt-1 text-sm text-zinc-500">{label}</div>
          </div>
        ))}
      </div>
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-medium">Recent interviews</h2>
          <Link href="/interviews" className="text-sm text-zinc-500 hover:text-zinc-900">
            View all
          </Link>
        </div>
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-4 py-2 font-medium">Company</th>
                <th className="px-4 py-2 font-medium">Contact</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Best score</th>
              </tr>
            </thead>
            <tbody>
              {interviews.map((interview) => {
                const best = interview.processes
                  .map((p) => p.opportunity?.scoreTotal ?? p.automationScore ?? 0)
                  .reduce((a, b) => Math.max(a, b), 0);
                return (
                  <tr key={interview.id} className="border-t border-zinc-100">
                    <td className="px-4 py-2">
                      <Link href={`/interviews/${interview.id}`} className="hover:underline">
                        {interview.company.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-zinc-600">
                      {interview.contact.firstName} · {interview.contact.role}
                    </td>
                    <td className="px-4 py-2">{interview.status}</td>
                    <td className="px-4 py-2">{best ? Math.round(best) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
