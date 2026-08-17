import Link from "next/link";
import { prisma } from "@/lib/db/prisma";

export default async function InterviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; vertical?: string }>;
}) {
  const { status, vertical } = await searchParams;
  const interviews = await prisma.interview.findMany({
    where: {
      status: status ? (status as never) : undefined,
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Interviews</h1>
      <form className="flex gap-3">
        <input name="vertical" placeholder="Filter vertical" defaultValue={vertical ?? ""} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" />
        <input name="status" placeholder="Filter status" defaultValue={status ?? ""} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" />
        <button className="btn-secondary" type="submit">
          Filter
        </button>
      </form>
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-4 py-2 font-medium">Company</th>
              <th className="px-4 py-2 font-medium">Contact</th>
              <th className="px-4 py-2 font-medium">Role</th>
              <th className="px-4 py-2 font-medium">Vertical</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Duration</th>
              <th className="px-4 py-2 font-medium">Turns</th>
              <th className="px-4 py-2 font-medium">Processes</th>
              <th className="px-4 py-2 font-medium">Best score</th>
              <th className="px-4 py-2 font-medium">Pilot</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {interviews.map((interview) => {
              const bestProcess = interview.processes
                .slice()
                .sort((a, b) => (b.opportunity?.scoreTotal ?? 0) - (a.opportunity?.scoreTotal ?? 0))[0];
              return (
                <tr key={interview.id} className="border-t border-zinc-100">
                  <td className="px-4 py-2">
                    <Link href={`/interviews/${interview.id}`} className="hover:underline">
                      {interview.company.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    {interview.contact.firstName} {interview.contact.lastName}
                  </td>
                  <td className="px-4 py-2 text-zinc-600">{interview.contact.role}</td>
                  <td className="px-4 py-2">{interview.company.vertical}</td>
                  <td className="px-4 py-2">{interview.status}</td>
                  <td className="px-4 py-2">
                    {interview.durationSeconds ? `${Math.round(interview.durationSeconds / 60)}m` : "—"}
                  </td>
                  <td className="px-4 py-2">{interview._count.messages}</td>
                  <td className="px-4 py-2">{interview.processes.length}</td>
                  <td className="px-4 py-2">
                    {bestProcess ? `${bestProcess.name} (${Math.round(bestProcess.opportunity?.scoreTotal ?? 0)})` : "—"}
                  </td>
                  <td className="px-4 py-2">{bestProcess?.opportunity?.pilotReadiness ?? "—"}</td>
                  <td className="px-4 py-2 text-right">
                    <Link href={`/interviews/${interview.id}#transcript`} className="font-medium hover:underline">
                      {interview._count.messages ? "Read chat" : "Open"}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
