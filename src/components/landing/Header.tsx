"use client";

import Link from "next/link";
import { AnimatePresence, motion, useScroll, useSpring } from "motion/react";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/brand/Logo";
import { CtaLink } from "@/components/landing/ui";
import { useSoftMotion } from "@/components/landing/motion";
import { SITE_NAME } from "@/lib/site";

const NAV = [
  { href: "/#solutions", label: "Solutions" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#use-cases", label: "Use cases" },
  { href: "/assessment", label: "Assessment" },
];

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { reduce, soft, ready } = useSoftMotion();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    const frame = window.requestAnimationFrame(onScroll);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-colors ${
        scrolled || open
          ? "border-white/10 bg-ink/92 md:bg-ink/80 md:backdrop-blur-xl"
          : "border-transparent bg-ink/80 md:bg-ink/40 md:backdrop-blur-md"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
        <Link href="/" className="inline-flex shrink-0 items-center gap-2.5 text-cloud">
          <BrandLogo size={30} alt="" priority />
          <span className="flex flex-col text-[12px] leading-[1.15] font-medium tracking-tight text-cloud/85 min-[460px]:flex-row min-[460px]:gap-1 min-[460px]:text-[13px]">
            {SITE_NAME.split(" ").map((word) => (
              <span key={word}>{word}</span>
            ))}
          </span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-mist lg:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="transition-colors hover:text-cloud">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <motion.div
            className="inline-flex"
            whileHover={reduce || soft ? undefined : { scale: 1.04 }}
            whileTap={reduce ? undefined : { scale: 0.97 }}
          >
            <CtaLink href="/assessment" className="h-9 px-3.5 text-xs sm:h-10 sm:px-5 sm:text-sm">
              Analyze My Processes
            </CtaLink>
          </motion.div>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/12 text-cloud lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((value) => !value)}
          >
            <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
            <MenuIcon open={open} />
          </button>
        </div>
      </div>
      <AnimatePresence>
        {open ? (
          <motion.div
            key="mobile-nav"
            id="mobile-nav"
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduce ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-t border-white/10 bg-ink lg:hidden"
          >
            <nav className="flex flex-col gap-1 px-5 py-5">
              {NAV.map((item, index) => (
                <motion.div
                  key={item.href}
                  initial={reduce ? false : { opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.04 * index }}
                >
                  <Link
                    href={item.href}
                    className="block rounded-xl px-3 py-3 text-sm text-cloud hover:bg-white/5"
                    onClick={() => setOpen(false)}
                  >
                    {item.label}
                  </Link>
                </motion.div>
              ))}
            </nav>
          </motion.div>
        ) : null}
      </AnimatePresence>
      {ready && !reduce && !soft ? <ScrollProgress /> : null}
    </header>
  );
}

function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 28, restDelta: 0.001 });

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-0 h-px origin-left bg-gradient-to-r from-brand via-brand-2 to-brand-3"
      style={{ scaleX }}
    />
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <motion.path d="M5 8h14" animate={{ d: open ? "M6 6L18 18" : "M5 8h14" }} transition={{ duration: 0.22 }} />
      <motion.path d="M5 12h14" animate={{ opacity: open ? 0 : 1 }} transition={{ duration: 0.16 }} />
      <motion.path d="M5 16h14" animate={{ d: open ? "M6 18L18 6" : "M5 16h14" }} transition={{ duration: 0.22 }} />
    </svg>
  );
}
