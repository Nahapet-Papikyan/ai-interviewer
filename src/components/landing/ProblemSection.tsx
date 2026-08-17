import { problemCards } from "@/components/landing/content";
import { Reveal } from "@/components/landing/Reveal";
import { Eyebrow, FlowChips, Section } from "@/components/landing/ui";

export function ProblemSection() {
  return (
    <Section>
      <Reveal>
        <Eyebrow>The hidden cost of manual work</Eyebrow>
        <h2 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-cloud sm:text-4xl">
          Your team shouldn&apos;t be the integration layer.
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-mist">
          Many business processes still depend on people copying information, checking documents,
          moving data between systems and repeating predictable decisions every day.
        </p>
      </Reveal>
      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {problemCards.map((card, index) => (
          <Reveal key={card.title} delay={index * 70}>
            <article className="h-full rounded-2xl border border-white/10 bg-ink-2 p-5">
              <h3 className="text-lg font-medium text-cloud">{card.title}</h3>
              <div className="mt-4">
                <FlowChips items={card.flow} />
              </div>
              <p className="mt-4 text-sm leading-6 text-mist">{card.copy}</p>
            </article>
          </Reveal>
        ))}
      </div>
      <p className="mt-10 max-w-3xl text-sm leading-7 text-mist">
        If a process repeats frequently, follows understandable rules and moves information between
        systems, there is a good chance part of it can be automated.
      </p>
    </Section>
  );
}
