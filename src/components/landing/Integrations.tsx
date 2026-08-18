"use client";

import { motion, useReducedMotion } from "motion/react";
import { systems } from "@/components/landing/content";
import { Item, Reveal, Stagger, fadeUp, inView, scaleIn } from "@/components/landing/motion";
import { Eyebrow, Section } from "@/components/landing/ui";

export function Integrations() {
  const reduce = useReducedMotion();

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
        <Stagger className="flex flex-wrap gap-2" delay={0.05} delayChildren={0.06}>
          {systems.map((name) => (
            <Item key={name} variants={scaleIn}>
              <motion.span
                className="inline-block rounded-full border border-white/10 bg-ink-2 px-3.5 py-2 text-sm text-cloud/90"
                whileHover={reduce ? undefined : { y: -3, borderColor: "rgb(22 135 248 / 0.45)", backgroundColor: "rgb(22 135 248 / 0.08)" }}
              >
                {name}
              </motion.span>
            </Item>
          ))}
        </Stagger>
        <Architecture />
      </div>
      <p className="mt-6 text-xs text-mist">Independent connections — not official partnerships.</p>
    </Section>
  );
}

function Architecture() {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className="rounded-2xl border border-white/10 bg-ink-2 p-5"
      initial={reduce ? false : "hidden"}
      whileInView="show"
      viewport={inView}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.12, delayChildren: 0.08 } } }}
    >
      <motion.div variants={fadeUp} className="grid grid-cols-3 gap-2 text-center text-xs text-cloud">
        {["Email", "Excel", "CRM"].map((label) => (
          <div key={label} className="rounded-xl border border-white/10 bg-ink px-2 py-3">
            {label}
          </div>
        ))}
      </motion.div>
      <Connector />
      <motion.div
        variants={scaleIn}
        className="rounded-xl border border-brand/30 bg-brand/10 px-3 py-3 text-center text-sm font-medium text-cloud"
      >
        Automation
      </motion.div>
      <Connector />
      <motion.div
        variants={scaleIn}
        className="rounded-xl border border-brand-3/35 bg-brand-3/10 px-3 py-3 text-center text-sm font-medium text-cloud"
      >
        AI layer
      </motion.div>
      <Connector />
      <motion.div variants={fadeUp} className="rounded-xl border border-white/10 bg-ink px-3 py-3 text-center text-sm text-cloud">
        ERP / 1C
      </motion.div>
    </motion.div>
  );
}

function Connector() {
  return (
    <motion.div variants={fadeUp} className="flex justify-center py-2">
      <span className="relative h-6 w-px overflow-hidden bg-gradient-to-b from-brand to-brand-3">
        <span className="landing-packet" />
      </span>
    </motion.div>
  );
}
