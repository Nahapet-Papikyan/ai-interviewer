"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/brand/Logo";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/companies", label: "Companies" },
  { href: "/contacts", label: "Contacts" },
  { href: "/interviews", label: "Interviews" },
  { href: "/processes", label: "Process Explorer" },
];

export function AdminNav() {
  const pathname = usePathname();

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-3">
        <Link href="/dashboard" className="shrink-0">
          <BrandMark size={28} />
        </Link>
        <nav className="flex flex-1 items-center gap-4 text-sm">
          {LINKS.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={active ? "font-medium text-zinc-950" : "text-zinc-500 hover:text-zinc-900"}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <button type="button" onClick={logout} className="text-sm text-zinc-500 hover:text-zinc-900">
          Log out
        </button>
      </div>
    </header>
  );
}
