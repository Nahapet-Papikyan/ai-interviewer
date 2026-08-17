import { InterviewStatus } from "@prisma/client";
import { notFound } from "next/navigation";
import { BrandLogo } from "@/components/brand/Logo";
import { InterviewClient } from "@/components/interview/InterviewClient";
import { findInterviewByToken, recordEvent, setStatus } from "@/lib/interview/session";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export default async function PublicInterviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const interview = await findInterviewByToken(token);
  if (!interview) notFound();

  if (interview.status === InterviewStatus.INVITED) {
    await setStatus(interview.id, InterviewStatus.OPENED, { openedAt: new Date() });
    await recordEvent(interview.id, "invitation_opened");
  }

  const messages = await prisma.interviewMessage.findMany({
    where: { interviewId: interview.id },
    orderBy: { sequenceNo: "asc" },
  });

  const finished = ["COMPLETED", "ANALYZING", "ANALYZED", "REVIEWED", "FOLLOW_UP_READY"].includes(
    interview.status,
  );

  if (finished) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16">
        <BrandLogo size={72} className="mb-6" />
        <h1 className="text-2xl font-semibold">This interview is complete</h1>
        <p className="mt-3 text-sm text-zinc-600">Thank you for your time.</p>
      </main>
    );
  }

  return (
    <InterviewClient
      token={token}
      firstName={interview.contact.firstName}
      companyName={interview.company.name}
      role={interview.contact.role}
      alreadyConsented={Boolean(interview.consentedAt)}
      language={interview.language}
      existingTurns={messages.map((m) => ({
        role: m.role === "assistant" || m.role === "user" ? m.role : "user",
        content: m.contentText,
      }))}
    />
  );
}
