import { CtaLink, Eyebrow, Section } from "@/components/landing/ui";

export function AssessmentCTA() {
  return (
    <Section id="assessment">
      <div className="relative overflow-hidden rounded-[1.8rem] border border-brand/25 bg-[linear-gradient(135deg,rgb(22_135_248_/_0.12),rgb(49_91_234_/_0.08)_40%,rgb(131_56_236_/_0.16))] px-5 py-10 sm:px-10 sm:py-14">
        <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <Eyebrow>Free process assessment</Eyebrow>
            <h2 className="mt-4 max-w-xl text-3xl font-semibold tracking-tight text-cloud sm:text-5xl">
              Find out what your business can automate.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-mist">
              Take a short AI-guided assessment about your company&apos;s operations. We&apos;ll identify
              repetitive processes worth investigating and highlight potential automation opportunities.
            </p>
            <ul className="mt-6 grid grid-cols-2 gap-3 text-sm text-cloud/90 sm:max-w-md">
              <li className="rounded-xl border border-white/10 bg-ink/40 px-3 py-2">~15 minutes</li>
              <li className="rounded-xl border border-white/10 bg-ink/40 px-3 py-2">Voice-guided</li>
              <li className="rounded-xl border border-white/10 bg-ink/40 px-3 py-2">No commitment</li>
              <li className="rounded-xl border border-white/10 bg-ink/40 px-3 py-2">Initial opportunity analysis</li>
            </ul>
            <CtaLink href="/assessment" className="mt-8 h-12 px-6 text-[15px]">
              Start Free Assessment
              <span aria-hidden>→</span>
            </CtaLink>
            <p className="mt-4 text-sm text-mist">
              You don&apos;t need technical knowledge. We&apos;ll ask about how your business works today.
            </p>
          </div>
          <VoiceMark />
        </div>
      </div>
    </Section>
  );
}

function VoiceMark() {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col items-center rounded-3xl border border-white/10 bg-ink/50 p-6">
      <div className="flex h-16 items-end gap-1.5" aria-hidden>
        {[10, 18, 28, 40, 24, 34, 16].map((h, i) => (
          <span
            key={i}
            className="landing-wave w-1.5 rounded-full bg-gradient-to-t from-brand-3 to-brand"
            style={{ height: h }}
          />
        ))}
      </div>
      <p className="mt-4 text-sm text-mist">Voice assessment</p>
      <div className="mt-5 w-full space-y-2">
        {["Order intake", "Invoice matching", "Weekly reporting"].map((label) => (
          <div key={label} className="flex items-center justify-between rounded-xl border border-white/10 bg-ink-2 px-3 py-2 text-xs text-cloud">
            <span>{label}</span>
            <span className="text-mist">To review</span>
          </div>
        ))}
      </div>
    </div>
  );
}
