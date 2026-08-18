"use client";

import { motion, useReducedMotion } from "motion/react";
import { Item, Reveal, Stagger, fadeUp } from "@/components/landing/motion";
import { Section } from "@/components/landing/ui";

const nodes = [
  { label: "Order received", kind: "source" },
  { label: "Parse source", kind: "automation" },
  { label: "Understand document", kind: "ai" },
  { label: "Validate SKU", kind: "rule" },
  { label: "Check inventory", kind: "system" },
] as const;

export function AutomationPhilosophy() {
  const reduce = useReducedMotion();

  return (
    <Section>
      <Reveal>
        <div className="overflow-hidden rounded-[1.7rem] border border-white/10 bg-ink-3 px-5 py-8 sm:px-8 sm:py-10">
          <h2 className="max-w-3xl text-3xl font-semibold tracking-tight text-cloud sm:text-4xl">
            AI where intelligence is needed. Automation everywhere else.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-mist">
            Not every step needs AI. Reliable business automation combines deterministic rules,
            integrations, APIs, validation, AI reasoning, and human review.
          </p>
          <div className="mt-10 grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <Stagger className="space-y-0" delay={0.08}>
              {nodes.map((node, index) => (
                <Item key={node.label} variants={fadeUp} className="flex flex-col">
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] uppercase ${kindClass(node.kind)}`}>
                      {kindLabel(node.kind)}
                    </span>
                    <span className="text-sm text-cloud">{node.label}</span>
                  </div>
                  {index < nodes.length - 1 ? (
                    <span className="relative ml-6 h-5 w-px bg-white/15">
                      <span className="landing-packet" />
                    </span>
                  ) : null}
                </Item>
              ))}
              <Item variants={fadeUp} className="mt-2 grid gap-3 sm:grid-cols-2">
                <motion.div
                  className="rounded-2xl border border-white/10 bg-ink-2 px-4 py-3"
                  whileHover={reduce ? undefined : { y: -3 }}
                >
                  <p className="text-[10px] font-semibold tracking-[0.14em] text-mist uppercase">No exception</p>
                  <p className="mt-1 text-sm text-cloud">ERP</p>
                </motion.div>
                <motion.div
                  className="rounded-2xl border border-brand-3/40 bg-brand-3/10 px-4 py-3"
                  whileHover={reduce ? undefined : { y: -3 }}
                >
                  <p className="text-[10px] font-semibold tracking-[0.14em] text-brand-3 uppercase">Exception</p>
                  <p className="mt-1 text-sm text-cloud">Human review</p>
                </motion.div>
              </Item>
            </Stagger>
            <p className="max-w-md text-base leading-7 text-mist">
              People stay in control of exceptions and important decisions. Automation handles the
              repetitive work.
            </p>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}

function kindLabel(kind: (typeof nodes)[number]["kind"]) {
  switch (kind) {
    case "source":
      return "Start";
    case "automation":
      return "Automation";
    case "ai":
      return "AI";
    case "rule":
      return "Rule";
    case "system":
      return "System";
  }
}

function kindClass(kind: (typeof nodes)[number]["kind"]) {
  switch (kind) {
    case "source":
      return "border border-white/12 text-mist";
    case "automation":
      return "border border-brand/30 bg-brand/10 text-brand";
    case "ai":
      return "border border-brand-2/35 bg-brand-2/10 text-[#9db4ff]";
    case "rule":
      return "border border-white/12 text-cloud";
    case "system":
      return "border border-white/12 bg-white/4 text-mist";
  }
}
