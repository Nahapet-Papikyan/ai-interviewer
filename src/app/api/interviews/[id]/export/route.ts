import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "json";
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
          steps: true,
          evidence: true,
          systems: true,
          opportunity: true,
        },
      },
    },
  });
  if (!interview) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (format === "csv") {
    const header = [
      "process",
      "cluster",
      "tx_month_min",
      "tx_month_max",
      "hours_month_min",
      "hours_month_max",
      "fte_min",
      "fte_max",
      "score",
      "pilot",
    ];
    const rows = interview.processes.map((p) =>
      [
        p.name,
        p.clusterTag ?? "",
        p.transactionsMonthMin ?? "",
        p.transactionsMonthMax ?? "",
        p.manualHoursMonthMin ?? "",
        p.manualHoursMonthMax ?? "",
        p.fteMin ?? "",
        p.fteMax ?? "",
        p.opportunity?.scoreTotal ?? "",
        p.opportunity?.pilotReadiness ?? "",
      ]
        .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
        .join(","),
    );
    return new NextResponse([header.join(","), ...rows].join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="interview-${id}.csv"`,
      },
    });
  }

  return NextResponse.json(interview, {
    headers: {
      "Content-Disposition": `attachment; filename="interview-${id}.json"`,
    },
  });
}
