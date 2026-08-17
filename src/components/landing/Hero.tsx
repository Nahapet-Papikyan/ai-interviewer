import { CtaLink, Eyebrow, Section } from "@/components/landing/ui";
import { WorkflowDemo } from "@/components/landing/WorkflowDemo";

export function Hero() {
  return (
    <Section className="relative overflow-hidden pt-10 pb-16 md:pt-16 md:pb-24">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgb(22_135_248_/_0.14),transparent_42%),radial-gradient(ellipse_at_80%_20%,rgb(131_56_236_/_0.12),transparent_40%)]"
      />
      <div className="relative grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <div>
          <Eyebrow>Business process automation</Eyebrow>
          <h1 className="mt-5 max-w-xl text-[2.35rem] leading-[1.08] font-semibold tracking-tight text-cloud sm:text-5xl lg:text-[4.25rem]">
            Turn manual work into automated workflows.
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-mist sm:text-lg">
            We identify repetitive processes consuming your team&apos;s time and build automation
            systems around the tools you already use.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <CtaLink href="/assessment" className="h-12 px-6 text-[15px]">
              Analyze My Processes
              <span aria-hidden>→</span>
            </CtaLink>
            <CtaLink href="#how-it-works" variant="secondary" className="h-12 px-6 text-[15px]">
              See how it works
            </CtaLink>
          </div>
          <p className="mt-5 text-sm text-mist">Free initial process assessment · No commitment</p>
        </div>
        <WorkflowDemo />
      </div>
    </Section>
  );
}
