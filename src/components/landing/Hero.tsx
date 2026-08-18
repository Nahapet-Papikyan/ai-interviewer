"use client";

import { motion, useReducedMotion } from "motion/react";
import { CtaLink, Eyebrow, Section } from "@/components/landing/ui";
import { WorkflowDemo } from "@/components/landing/WorkflowDemo";
import { easeOutExpo, fadeBlur, inView, stagger, wordReveal } from "@/components/landing/motion";

const HEADLINE = ["Turn", "manual", "work", "into", "automated", "workflows."];

export function Hero() {
  const reduce = useReducedMotion();

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
          variants={stagger(0.08, 0.04)}
        >
          <motion.div variants={fadeBlur}>
            <Eyebrow>Business process automation</Eyebrow>
          </motion.div>
          <motion.h1
            variants={stagger(0.055, 0)}
            className="mt-5 max-w-xl text-[2.35rem] leading-[1.08] font-semibold tracking-tight text-cloud sm:text-5xl lg:text-[4.25rem]"
            style={{ perspective: 900 }}
          >
            {HEADLINE.map((word, index) => (
              <motion.span
                key={`${word}-${index}`}
                className="mr-[0.28em] inline-block last:mr-0"
                variants={reduce ? undefined : wordReveal}
                style={{ transformOrigin: "50% 100%" }}
              >
                {word}
              </motion.span>
            ))}
          </motion.h1>
          <motion.p variants={fadeBlur} className="mt-6 max-w-lg text-base leading-7 text-mist sm:text-lg">
            We identify repetitive processes consuming your team&apos;s time and build automation
            systems around the tools you already use.
          </motion.p>
          <motion.div variants={fadeBlur} className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <motion.div
              className="inline-flex"
              whileHover={reduce ? undefined : { scale: 1.04 }}
              whileTap={reduce ? undefined : { scale: 0.97 }}
            >
              <CtaLink href="/assessment" className="h-12 px-6 text-[15px]">
                Analyze My Processes
                <span aria-hidden>→</span>
              </CtaLink>
            </motion.div>
            <motion.div
              className="inline-flex"
              whileHover={reduce ? undefined : { scale: 1.04 }}
              whileTap={reduce ? undefined : { scale: 0.97 }}
            >
              <CtaLink href="#how-it-works" variant="secondary" className="h-12 px-6 text-[15px]">
                See how it works
              </CtaLink>
            </motion.div>
          </motion.div>
          <motion.p variants={fadeBlur} className="mt-5 text-sm text-mist">
            Free initial process assessment · No commitment
          </motion.p>
        </motion.div>
        <motion.div
          initial={reduce ? false : { opacity: 0, x: 48, rotateY: -12, scale: 0.94 }}
          whileInView={reduce ? undefined : { opacity: 1, x: 0, rotateY: 0, scale: 1 }}
          viewport={inView}
          transition={{ duration: 0.9, delay: 0.2, ease: easeOutExpo }}
          style={{ perspective: 1200 }}
        >
          <WorkflowDemo />
        </motion.div>
      </div>
    </Section>
  );
}

function HeroOrbs() {
  const reduce = useReducedMotion();
  if (reduce) return null;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        className="absolute -top-16 -left-10 h-72 w-72 rounded-full bg-brand/18 blur-3xl"
        animate={{ x: [0, 36, -12, 0], y: [0, 18, -22, 0], scale: [1, 1.12, 0.94, 1] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-8 right-0 h-80 w-80 rounded-full bg-brand-3/16 blur-3xl"
        animate={{ x: [0, -28, 16, 0], y: [0, 24, -14, 0], scale: [1, 0.9, 1.1, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}
