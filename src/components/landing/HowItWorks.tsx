import { steps } from "@/components/landing/content";
import { Reveal } from "@/components/landing/Reveal";
import { Eyebrow, Section } from "@/components/landing/ui";

export function HowItWorks() {
  return (
    <Section id="how-it-works">
      <Reveal>
        <Eyebrow>From process to automation</Eyebrow>
        <h2 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-cloud sm:text-4xl">
          We automate the work that should not require people.
        </h2>
      </Reveal>
      <div className="relative mt-12 grid gap-4 md:grid-cols-4">
        <div
          aria-hidden
          className="pointer-events-none absolute top-7 right-8 left-8 hidden h-px bg-gradient-to-r from-brand via-brand-2 to-brand-3 md:block"
        />
        {steps.map((step, index) => (
          <Reveal key={step.n} delay={index * 80} className="h-full">
            <article className="relative flex h-full flex-col rounded-2xl border border-white/10 bg-ink-2 p-5">
              <span className="relative z-10 mb-4 inline-flex h-8 w-8 items-center justify-center rounded-full border border-brand/40 bg-ink text-xs font-semibold text-brand">
                {step.n}
              </span>
              <h3 className="text-lg font-medium text-cloud">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-mist">{step.copy}</p>
            </article>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
