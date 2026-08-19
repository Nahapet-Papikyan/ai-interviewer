"use client";

import { motion } from "motion/react";
import { fadeUp, inView, scaleIn, stagger, useSoftMotion } from "@/components/landing/motion";

function Node({
  label,
  hint,
  tone = "default",
  soft = false,
}: {
  label: string;
  hint?: string;
  tone?: "default" | "ai" | "human" | "done";
  soft?: boolean;
}) {
  const tones = {
    default: "border-white/12 bg-ink-3",
    ai: "border-brand/40 bg-brand/10 landing-node-live",
    human: "border-brand-3/45 bg-brand-3/10",
    done: "border-white/14 bg-white/6",
  };

  return (
    <motion.div
      variants={soft ? fadeUp : scaleIn}
      className={`w-full rounded-2xl border px-4 py-3 text-center ${tones[tone]}`}
    >
      <p className="text-sm font-medium text-cloud">{label}</p>
      {hint ? <p className="mt-0.5 text-[10px] font-semibold tracking-[0.14em] text-mist uppercase">{hint}</p> : null}
    </motion.div>
  );
}

function Rail({ delay = "0s" }: { delay?: string }) {
  return (
    <motion.div variants={fadeUp} className="relative h-7 w-px overflow-hidden bg-gradient-to-b from-brand via-brand-2 to-brand-3">
      <span className="landing-packet" style={{ animationDelay: delay }} />
    </motion.div>
  );
}

export function WorkflowDemo() {
  const { reduce, soft } = useSoftMotion();

  return (
    <div className="relative mx-auto w-full max-w-[380px]">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-8 rounded-[2rem] bg-[radial-gradient(circle_at_50%_30%,rgb(22_135_248_/_0.16),transparent_62%)]"
      />
      <motion.div
        className="relative rounded-[1.6rem] border border-white/10 bg-ink-2/80 p-5 shadow-[0_24px_80px_rgb(0_0_0_/_0.35)]"
        initial={reduce ? false : "hidden"}
        whileInView="show"
        viewport={inView}
        variants={stagger(soft ? 0.05 : 0.08, soft ? 0.04 : 0.12)}
        whileHover={reduce || soft ? undefined : { y: -4 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.div variants={fadeUp} className="mb-4 flex items-center justify-between text-[11px] text-mist">
          <span>Incoming work</span>
          <span className="rounded-full border border-white/10 px-2 py-0.5 text-cloud/80">Live flow</span>
        </motion.div>
        <motion.div className="flex flex-col items-center" variants={stagger(soft ? 0.04 : 0.07, 0)}>
          <Node label="Email" soft={soft} />
          <Rail />
          <Node label="Understand document" hint="AI" tone="ai" soft={soft} />
          <Rail delay="0.4s" />
          <Node label="Validate data" soft={soft} />
          <Rail delay="0.8s" />
          <Node label="Decision" soft={soft} />
          <motion.div variants={fadeUp} className="relative w-full pt-8">
            <svg
              className="pointer-events-none absolute inset-x-[18%] top-0 h-8"
              viewBox="0 0 200 32"
              fill="none"
              aria-hidden
            >
              <path d="M100 0 V8 C100 22 28 22 28 32" className="landing-dash" stroke="#315BEA" strokeWidth="1.2" />
              <path d="M100 0 V8 C100 22 172 22 172 32" className="landing-dash" stroke="#8338EC" strokeWidth="1.2" />
            </svg>
            <div className="grid w-full grid-cols-2 gap-3">
              <Node label="ERP" soft={soft} />
              <Node label="Human review" hint="Exception" tone="human" soft={soft} />
            </div>
          </motion.div>
          <Rail delay="1.2s" />
          <Node label="Complete" tone="done" soft={soft} />
        </motion.div>
      </motion.div>
    </div>
  );
}
