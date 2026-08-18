import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { runInterviewAnalysis } from "@/lib/openai/analyzer";

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const interviewId = typeof body?.interviewId === "string" ? body.interviewId : "";
  if (!interviewId) {
    return NextResponse.json({ error: "interviewId required" }, { status: 400 });
  }
  try {
    await runInterviewAnalysis(interviewId, { force: true });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Analysis failed" },
      { status: 500 },
    );
  }
}
