"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion, type Variants } from "motion/react";

export const easeOutExpo = [0.22, 1, 0.36, 1] as const;

export const inView = {
  once: true,
  amount: 0.2,
  margin: "0px 0px -8% 0px",
} as const;

export const inViewSoft = {
  once: true,
  amount: 0.45,
} as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: easeOutExpo },
  },
};

export const fadeUpSoft: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: easeOutExpo },
  },
};

/** Blur filters are expensive on mobile; keep a fade/slide only. */
export const fadeBlur = fadeUp;

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.98, y: 12 },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.45, ease: easeOutExpo },
  },
};

export const wordReveal: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: easeOutExpo },
  },
};

export function stagger(staggerChildren = 0.09, delayChildren = 0.05): Variants {
  return {
    hidden: {},
    show: { transition: { staggerChildren, delayChildren } },
  };
}

export const springHover = {
  type: "spring" as const,
  stiffness: 420,
  damping: 28,
};

export function useSoftMotion() {
  const reduce = useReducedMotion();
  const [soft, setSoft] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => setSoft(media.matches);
    update();
    setReady(true);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return { reduce: Boolean(reduce), soft, ready };
}

function resolveVariants(variants: Variants, soft: boolean) {
  if (!soft) return variants;
  if (variants === scaleIn) return fadeUpSoft;
  return fadeUpSoft;
}

type BoxProps = {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  variants?: Variants;
};

export function Reveal({
  children,
  className = "",
  delay = 0,
  variants = fadeUp,
}: BoxProps) {
  const { reduce, soft } = useSoftMotion();

  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={soft ? inViewSoft : inView}
      variants={resolveVariants(variants, soft)}
      transition={{ delay: delay / 1000 }}
    >
      {children}
    </motion.div>
  );
}

export function Stagger({
  children,
  className = "",
  delay = 0.09,
  delayChildren = 0.04,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  delayChildren?: number;
}) {
  const { reduce, soft } = useSoftMotion();

  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={soft ? inViewSoft : inView}
      variants={stagger(soft ? Math.min(delay, 0.06) : delay, soft ? 0.02 : delayChildren)}
    >
      {children}
    </motion.div>
  );
}

export function Item({
  children,
  className = "",
  variants = fadeUp,
  hover = false,
}: BoxProps & { hover?: boolean }) {
  const { reduce, soft } = useSoftMotion();

  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      variants={resolveVariants(variants, soft)}
      whileHover={!soft && hover ? { y: -6, transition: springHover } : undefined}
    >
      {children}
    </motion.div>
  );
}
