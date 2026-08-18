"use client";

import { motion, useReducedMotion, type Variants } from "motion/react";

export const easeOutExpo = [0.22, 1, 0.36, 1] as const;

export const inView = {
  once: true,
  amount: 0.2,
  margin: "0px 0px -8% 0px",
} as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, ease: easeOutExpo },
  },
};

export const fadeBlur: Variants = {
  hidden: { opacity: 0, y: 18, filter: "blur(10px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.7, ease: easeOutExpo },
  },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.92, y: 18 },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: "spring", stiffness: 260, damping: 22 },
  },
};

export const wordReveal: Variants = {
  hidden: { opacity: 0, y: 36, rotateX: -50 },
  show: {
    opacity: 1,
    y: 0,
    rotateX: 0,
    transition: { duration: 0.55, ease: easeOutExpo },
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
  const reduce = useReducedMotion();

  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={inView}
      variants={variants}
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
  const reduce = useReducedMotion();

  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={inView}
      variants={stagger(delay, delayChildren)}
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
  const reduce = useReducedMotion();

  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      variants={variants}
      whileHover={hover ? { y: -6, transition: springHover } : undefined}
    >
      {children}
    </motion.div>
  );
}
