"use client";

import { motion, useReducedMotion } from "motion/react";
import { CtaLink, Eyebrow, Section } from "@/components/landing/ui";
import { fadeUp, fadeUpSoft, inView, stagger, useSoftMotion } from "@/components/landing/motion";

export function AssessmentCTA() {
  const reduce = useReducedMotion();
  const { soft, ready } = useSoftMotion();
  const copyVariants = soft ? fadeUpSoft : fadeUp;

  return (
    <Section id="assessment">
      <motion.div
        className="relative overflow-hidden rounded-[1.8rem] border border-brand/25 bg-[linear-gradient(135deg,rgb(22_135_248_/_0.12),rgb(49_91_234_/_0.08)_40%,rgb(131_56_236_/_0.16))] px-5 py-10 sm:px-10 sm:py-14"
        initial={reduce ? false : { opacity: 0, y: soft ? 12 : 28, scale: soft ? 1 : 0.98 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={inView}
        transition={{ duration: soft ? 0.4 : 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        {reduce ? null : (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-brand/20 blur-3xl"
            animate={ready && !soft ? { x: [0, 18, -10, 0], y: [0, 14, -8, 0], opacity: [0.45, 0.7, 0.5, 0.45] } : undefined}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
        <div className="relative grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <motion.div
            initial={reduce ? false : "hidden"}
            whileInView="show"
            viewport={inView}
            variants={stagger(soft ? 0.05 : 0.08, soft ? 0.02 : 0.05)}
          >
            <motion.div variants={copyVariants}>
              <Eyebrow>Free process assessment</Eyebrow>
            </motion.div>
            <motion.h2 variants={copyVariants} className="mt-4 max-w-xl text-3xl font-semibold tracking-tight text-cloud sm:text-5xl">
              Find out what your business can automate.
            </motion.h2>
            <motion.p variants={copyVariants} className="mt-4 max-w-xl text-base leading-7 text-mist">
              Take a short AI-guided assessment about your company&apos;s operations. We&apos;ll identify
              repetitive processes worth investigating and highlight potential automation opportunities.
            </motion.p>
            <motion.ul variants={copyVariants} className="mt-6 grid grid-cols-2 gap-3 text-sm text-cloud/90 sm:max-w-md">
              <li className="rounded-xl border border-white/10 bg-ink/40 px-3 py-2">~15 minutes</li>
              <li className="rounded-xl border border-white/10 bg-ink/40 px-3 py-2">Voice-guided</li>
              <li className="rounded-xl border border-white/10 bg-ink/40 px-3 py-2">No commitment</li>
              <li className="rounded-xl border border-white/10 bg-ink/40 px-3 py-2">Initial opportunity analysis</li>
            </motion.ul>
            <motion.div
              className="inline-flex"
              variants={copyVariants}
              whileHover={reduce || soft ? undefined : { scale: 1.04 }}
              whileTap={reduce ? undefined : { scale: 0.97 }}
            >
              <CtaLink href="/assessment" className="mt-8 h-12 px-6 text-[15px]">
                Start Free Assessment
                <span aria-hidden>→</span>
              </CtaLink>
            </motion.div>
            <motion.p variants={copyVariants} className="mt-4 text-sm text-mist">
              You don&apos;t need technical knowledge. We&apos;ll ask about how your business works today.
            </motion.p>
          </motion.div>
          <VoiceMark />
        </div>
      </motion.div>
    </Section>
  );
}

function VoiceMark() {
  const reduce = useReducedMotion();
  const { soft, ready } = useSoftMotion();

  return (
    <motion.div
      className="mx-auto w-full max-w-sm"
      initial={reduce ? false : { opacity: 0, y: soft ? 10 : 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={inView}
      transition={{ duration: soft ? 0.4 : 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        className="flex w-full flex-col items-center rounded-3xl border border-white/10 bg-ink/50 p-6"
        animate={reduce || !ready || soft ? undefined : { y: [0, -6, 0] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="flex h-16 items-end gap-1.5" aria-hidden>
          {[10, 18, 28, 40, 24, 34, 16].map((h, i) => (
            <span
              key={i}
              className="landing-wave w-1.5 rounded-full bg-gradient-to-t from-brand-3 to-brand"
              style={{ height: h }}
            />
          ))}
        </div>
        <p className="mt-4 text-sm text-mist">Voice assessment</p>
        <div className="mt-5 w-full space-y-2">
          {["Order intake", "Invoice matching", "Weekly reporting"].map((label, index) => (
            <motion.div
              key={label}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-ink-2 px-3 py-2 text-xs text-cloud"
              initial={reduce ? false : { opacity: 0, x: 12 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={inView}
              transition={{ delay: 0.12 + index * 0.08 }}
            >
              <span>{label}</span>
              <span className="text-mist">To review</span>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
