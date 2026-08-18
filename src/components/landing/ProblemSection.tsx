"use client";

import { motion, useReducedMotion } from "motion/react";
import { problemCards } from "@/components/landing/content";
import { Item, Reveal, Stagger } from "@/components/landing/motion";
import { Eyebrow, FlowChips, Section } from "@/components/landing/ui";

export function ProblemSection() {
  const reduce = useReducedMotion();

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
      <Stagger className="mt-10 grid gap-4 md:grid-cols-2" delay={0.1} delayChildren={0.08}>
        {problemCards.map((card) => (
          <Item key={card.title} hover className="h-full">
            <article className="h-full rounded-2xl border border-white/10 bg-ink-2 p-5">
              <h3 className="text-lg font-medium text-cloud">{card.title}</h3>
              <div className="mt-4">
                <FlowChips items={card.flow} />
              </div>
              <p className="mt-4 text-sm leading-6 text-mist">{card.copy}</p>
            </article>
          </Item>
        ))}
      </Stagger>
      <motion.p
        initial={reduce ? false : { opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        className="mt-10 max-w-3xl text-sm leading-7 text-mist"
      >
        If a process repeats frequently, follows understandable rules and moves information between
        systems, there is a good chance part of it can be automated.
      </motion.p>
    </Section>
  );
}
