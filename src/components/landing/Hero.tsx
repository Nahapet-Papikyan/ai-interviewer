"use client";

import { motion, useReducedMotion } from "motion/react";
import { CtaLink, Eyebrow, Section } from "@/components/landing/ui";
import { WorkflowDemo } from "@/components/landing/WorkflowDemo";
import { easeOutExpo, fadeBlur, fadeUpSoft, inView, stagger, useSoftMotion, wordReveal } from "@/components/landing/motion";

const HEADLINE = ["Turn", "manual", "work", "into", "automated", "workflows."];

export function Hero() {
  const reduce = useReducedMotion();
  const { soft } = useSoftMotion();
  const copyVariants = soft ? fadeUpSoft : fadeBlur;
  const hover = reduce || soft ? undefined : { scale: 1.04 };
  const tap = reduce ? undefined : { scale: 0.97 };

  return (
    <Section className="relative overflow-hidden pt-10 pb-16 md:pt-16 md:pb-24">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgb(22_135_248_/_0.14),transparent_42%),radial-gradient(ellipse_at_80%_20%,rgb(131_56_236_/_0.12),transparent_40%)]"
      />
      <HeroOrbs />
      <div className="relative grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <motion.div
          initial={reduce ? false : "hidden"}
          animate="show"
          variants={stagger(soft ? 0.05 : 0.08, soft ? 0.02 : 0.04)}
        >
          <motion.div variants={copyVariants}>
            <Eyebrow>Business process automation</Eyebrow>
          </motion.div>
          <motion.h1
            variants={soft ? fadeUpSoft : stagger(0.055, 0)}
            className="mt-5 max-w-xl text-[2.35rem] leading-[1.08] font-semibold tracking-tight text-cloud sm:text-5xl lg:text-[4.25rem]"
          >
            {HEADLINE.map((word, index) => (
              <motion.span
                key={`${word}-${index}`}
                className="mr-[0.28em] inline-block last:mr-0"
                variants={reduce || soft ? undefined : wordReveal}
              >
                {word}
              </motion.span>
            ))}
          </motion.h1>
          <motion.p variants={copyVariants} className="mt-6 max-w-lg text-base leading-7 text-mist sm:text-lg">
            We identify repetitive processes consuming your team&apos;s time and build automation
            systems around the tools you already use.
          </motion.p>
          <motion.div variants={copyVariants} className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <motion.div className="inline-flex" whileHover={hover} whileTap={tap}>
              <CtaLink href="/assessment" className="h-12 px-6 text-[15px]">
                Analyze My Processes
                <span aria-hidden>→</span>
              </CtaLink>
            </motion.div>
            <motion.div className="inline-flex" whileHover={hover} whileTap={tap}>
              <CtaLink href="#how-it-works" variant="secondary" className="h-12 px-6 text-[15px]">
                See how it works
              </CtaLink>
            </motion.div>
          </motion.div>
          <motion.p variants={copyVariants} className="mt-5 text-sm text-mist">
            Free initial process assessment · No commitment
          </motion.p>
        </motion.div>
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16 }}
          whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
          viewport={inView}
          transition={{ duration: soft ? 0.4 : 0.65, delay: soft ? 0.04 : 0.12, ease: easeOutExpo }}
        >
          <WorkflowDemo />
        </motion.div>
      </div>
    </Section>
  );
}

function HeroOrbs() {
  const { reduce, soft, ready } = useSoftMotion();
  if (reduce) return null;

  const drifting = ready && !soft;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        className="absolute -top-16 -left-10 h-72 w-72 rounded-full bg-brand/18 blur-3xl md:blur-3xl"
        animate={drifting ? { x: [0, 36, -12, 0], y: [0, 18, -22, 0], scale: [1, 1.12, 0.94, 1] } : undefined}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-8 right-0 h-80 w-80 rounded-full bg-brand-3/16 blur-3xl"
        animate={drifting ? { x: [0, -28, 16, 0], y: [0, 24, -14, 0], scale: [1, 0.9, 1.1, 1] } : undefined}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}
