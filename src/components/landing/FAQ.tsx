"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { faqs } from "@/components/landing/content";
import { Reveal, easeOutExpo } from "@/components/landing/motion";
import { Section } from "@/components/landing/ui";

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  const reduce = useReducedMotion();

  return (
    <Section>
      <Reveal>
        <h2 className="text-3xl font-semibold tracking-tight text-cloud sm:text-4xl">Questions</h2>
      </Reveal>
      <div className="mt-8 divide-y divide-white/10 rounded-2xl border border-white/10 bg-ink-2">
        {faqs.map((item, index) => {
          const expanded = open === index;
          return (
            <div key={item.q}>
              <h3>
                <button
                  type="button"
                  aria-expanded={expanded}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-medium text-cloud sm:text-base"
                  onClick={() => setOpen(expanded ? null : index)}
                >
                  {item.q}
                  <motion.span
                    aria-hidden
                    className="text-mist"
                    animate={{ rotate: expanded ? 45 : 0 }}
                    transition={{ duration: 0.22 }}
                  >
                    +
                  </motion.span>
                </button>
              </h3>
              <AnimatePresence initial={false}>
                {expanded ? (
                  <motion.div
                    key="answer"
                    initial={reduce ? false : { height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={reduce ? undefined : { height: 0, opacity: 0 }}
                    transition={{ duration: 0.32, ease: easeOutExpo }}
                    className="overflow-hidden"
                  >
                    <p className="px-5 pb-5 text-sm leading-7 text-mist">{item.a}</p>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
