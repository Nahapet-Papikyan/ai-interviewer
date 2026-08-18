"use client";

import { outcomes } from "@/components/landing/content";
import { Item, Reveal, Stagger, scaleIn } from "@/components/landing/motion";
import { Section } from "@/components/landing/ui";

export function Outcomes() {
  return (
    <Section>
      <Reveal>
        <h2 className="max-w-3xl text-3xl font-semibold tracking-tight text-cloud sm:text-4xl">
          Automation should create measurable results.
        </h2>
      </Reveal>
      <Stagger className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" delay={0.1} delayChildren={0.08}>
        {outcomes.map((item) => (
          <Item key={item.title} variants={scaleIn} hover className="h-full">
            <article className="h-full rounded-2xl border border-white/10 bg-ink-2 p-5">
              <h3 className="text-lg font-medium text-cloud">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-mist">{item.copy}</p>
            </article>
          </Item>
        ))}
      </Stagger>
    </Section>
  );
}
