"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/brand/Logo";
import { CtaLink } from "@/components/landing/ui";
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
          ? "border-white/10 bg-ink/80 backdrop-blur-xl"
          : "border-transparent bg-ink/40 backdrop-blur-md"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
        <Link href="/" className="inline-flex items-center gap-2.5 text-cloud">
          <BrandLogo size={30} alt="" priority />
          <span className="text-[13px] font-medium tracking-tight text-cloud/85">{SITE_NAME}</span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-mist lg:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="transition-colors hover:text-cloud">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <CtaLink href="/assessment" className="px-3.5 py-2 text-xs sm:px-5 sm:py-2.5 sm:text-sm">
            Analyze My Processes
          </CtaLink>
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
      {open ? (
        <div id="mobile-nav" className="border-t border-white/10 bg-ink px-5 py-5 lg:hidden">
          <nav className="flex flex-col gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-xl px-3 py-3 text-sm text-cloud hover:bg-white/5"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      ) : null}
    </header>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      {open ? (
        <path d="M6 6l12 12M18 6L6 18" />
      ) : (
        <>
          <path d="M5 8h14M5 12h14M5 16h14" />
        </>
      )}
    </svg>
  );
}
