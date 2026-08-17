import { systems } from "@/components/landing/content";
import { Reveal } from "@/components/landing/Reveal";
import { Eyebrow, Section } from "@/components/landing/ui";

export function Integrations() {
  return (
    <Section id="solutions">
      <Reveal>
        <Eyebrow>Work with what you already have</Eyebrow>
        <h2 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-cloud sm:text-4xl">
          Your systems don&apos;t need to be replaced.
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-mist">
          Automation should connect your existing tools — not force your company to rebuild everything
          from scratch.
        </p>
      </Reveal>
      <div className="mt-10 grid items-start gap-8 lg:grid-cols-[1fr_0.9fr]">
        <div className="flex flex-wrap gap-2">
          {systems.map((name) => (
            <span
              key={name}
              className="rounded-full border border-white/10 bg-ink-2 px-3.5 py-2 text-sm text-cloud/90"
            >
              {name}
            </span>
          ))}
        </div>
        <Architecture />
      </div>
      <p className="mt-6 text-xs text-mist">Independent connections — not official partnerships.</p>
    </Section>
  );
}

function Architecture() {
  return (
    <div className="rounded-2xl border border-white/10 bg-ink-2 p-5">
      <div className="grid grid-cols-3 gap-2 text-center text-xs text-cloud">
        {["Email", "Excel", "CRM"].map((label) => (
          <div key={label} className="rounded-xl border border-white/10 bg-ink px-2 py-3">
            {label}
          </div>
        ))}
      </div>
      <div className="flex justify-center py-2">
        <span className="h-6 w-px bg-gradient-to-b from-brand to-brand-2" />
      </div>
      <div className="rounded-xl border border-brand/30 bg-brand/10 px-3 py-3 text-center text-sm font-medium text-cloud">
        Automation
      </div>
      <div className="flex justify-center py-2">
        <span className="h-6 w-px bg-gradient-to-b from-brand-2 to-brand-3" />
      </div>
      <div className="rounded-xl border border-brand-3/35 bg-brand-3/10 px-3 py-3 text-center text-sm font-medium text-cloud">
        AI layer
      </div>
      <div className="flex justify-center py-2">
        <span className="h-6 w-px bg-gradient-to-b from-brand-3 to-white/20" />
      </div>
      <div className="rounded-xl border border-white/10 bg-ink px-3 py-3 text-center text-sm text-cloud">
        ERP / 1C
      </div>
    </div>
  );
}
