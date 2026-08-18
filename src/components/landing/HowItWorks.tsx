"use client";

import { motion, useReducedMotion } from "motion/react";
import { steps } from "@/components/landing/content";
import { Item, Reveal, Stagger, easeOutExpo, inView, scaleIn } from "@/components/landing/motion";
import { Eyebrow, Section } from "@/components/landing/ui";

export function HowItWorks() {
  const reduce = useReducedMotion();

  return (
    <Section id="how-it-works">
      <Reveal>
        <Eyebrow>From process to automation</Eyebrow>
        <h2 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-cloud sm:text-4xl">
          We automate the work that should not require people.
        </h2>
      </Reveal>
      <div className="relative mt-12">
        <motion.div
          aria-hidden
          className="pointer-events-none absolute top-7 right-8 left-8 hidden h-px origin-left bg-gradient-to-r from-brand via-brand-2 to-brand-3 md:block"
          initial={reduce ? false : { scaleX: 0, opacity: 0 }}
          whileInView={{ scaleX: 1, opacity: 1 }}
          viewport={inView}
          transition={{ duration: 1.05, delay: 0.15, ease: easeOutExpo }}
        />
        <Stagger className="grid gap-4 md:grid-cols-4" delay={0.12} delayChildren={0.1}>
          {steps.map((step) => (
            <Item key={step.n} variants={scaleIn} hover className="h-full">
              <article className="relative flex h-full flex-col rounded-2xl border border-white/10 bg-ink-2 p-5">
                <span className="relative z-10 mb-4 inline-flex h-8 w-8 items-center justify-center rounded-full border border-brand/40 bg-ink text-xs font-semibold text-brand">
                  {step.n}
                </span>
                <h3 className="text-lg font-medium text-cloud">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-mist">{step.copy}</p>
              </article>
            </Item>
          ))}
        </Stagger>
      </div>
    </Section>
  );
}
