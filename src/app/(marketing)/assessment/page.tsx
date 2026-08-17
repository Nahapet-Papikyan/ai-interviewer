import type { Metadata } from "next";
import { AssessmentStart } from "@/components/landing/AssessmentStart";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Free Process Assessment",
  description:
    "Start a 15-minute AI-guided assessment to identify repetitive processes and automation opportunities.",
  alternates: { canonical: "/assessment" },
};

export default function AssessmentPage() {
  return (
    <main className="px-5 py-12 sm:px-8 sm:py-16">
      <div className="mx-auto grid w-full max-w-5xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.18em] text-brand uppercase">
            Free process assessment
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-cloud sm:text-5xl">
            Tell us how your operations work today.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-mist">
            A short voice interview maps repetitive work, systems, and where automation may help.
            No technical preparation required.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-mist">
            <li>About 15–20 minutes</li>
            <li>Voice-guided, with text if you prefer</li>
            <li>No project commitment</li>
          </ul>
        </div>
        <AssessmentStart />
      </div>
      <p className="sr-only">Assessment for {SITE_NAME}</p>
    </main>
  );
}
