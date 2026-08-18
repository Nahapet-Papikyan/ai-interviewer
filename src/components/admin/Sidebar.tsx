"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BrandLogo } from "@/components/brand/Logo";
import { SITE_NAME } from "@/lib/site";

const GROUPS = [
  {
    label: "Overview",
    items: [{ href: "/dashboard", label: "Dashboard", icon: HomeIcon }],
  },
  {
    label: "Research",
    items: [
      { href: "/interviews", label: "Interviews", icon: ChatIcon },
      { href: "/processes", label: "Process explorer", icon: LayersIcon },
    ],
  },
  {
    label: "Directory",
    items: [
      { href: "/companies", label: "Companies", icon: BuildingIcon },
      { href: "/contacts", label: "Contacts", icon: UsersIcon },
    ],
  },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-zinc-200 bg-white/90 px-4 backdrop-blur lg:hidden">
        <Link href="/dashboard" className="inline-flex items-center gap-2">
          <BrandLogo size={26} alt="" />
          <span className="text-sm font-semibold tracking-tight">{SITE_NAME}</span>
        </Link>
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 text-ink"
          aria-expanded={open}
          aria-controls="admin-sidebar"
          onClick={() => setOpen((value) => !value)}
        >
          <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          <MenuIcon open={open} />
        </button>
      </header>

      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-ink/40 lg:hidden"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside
        id="admin-sidebar"
        className={`fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col bg-ink text-cloud transition-transform lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center gap-2.5 px-5">
          <Link href="/dashboard" className="inline-flex items-center gap-2.5" onClick={() => setOpen(false)}>
            <BrandLogo size={28} alt="" />
            <span className="flex flex-col leading-tight">
              <span className="text-[13px] font-semibold tracking-tight">{SITE_NAME}</span>
              <span className="text-[10px] font-medium tracking-[0.14em] text-mist uppercase">Discovery</span>
            </span>
          </Link>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
          {GROUPS.map((group) => (
            <div key={group.label}>
              <p className="px-3 text-[10px] font-semibold tracking-[0.16em] text-mist/70 uppercase">{group.label}</p>
              <ul className="mt-1.5 space-y-0.5">
                {group.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        onClick={() => setOpen(false)}
                        className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors ${
                          active ? "bg-white/10 text-white" : "text-mist hover:bg-white/5 hover:text-cloud"
                        }`}
                      >
                        <item.icon />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/8 p-3">
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-mist transition-colors hover:bg-white/5 hover:text-cloud"
          >
            <LogoutIcon />
            Log out
          </button>
        </div>
      </aside>
    </>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M5 8h14M5 12h14M5 16h14" />}
    </svg>
  );
}

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6">
      {children}
    </svg>
  );
}

function HomeIcon() {
  return (
    <Icon>
      <path d="M3.5 9.5 10 3.5l6.5 6V16a1 1 0 0 1-1 1h-3.5v-4h-4v4H4.5a1 1 0 0 1-1-1z" />
    </Icon>
  );
}

function ChatIcon() {
  return (
    <Icon>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h9A1.5 1.5 0 0 1 16 5.5v6A1.5 1.5 0 0 1 14.5 13H9l-4 3v-3H5.5A1.5 1.5 0 0 1 4 11.5z" />
    </Icon>
  );
}

function LayersIcon() {
  return (
    <Icon>
      <path d="M10 3.5 17 7l-7 3.5L3 7zM4.2 10.4 3 11l7 3.5L17 11l-1.2-.6M4.2 13.6 3 14.2 10 17.7l7-3.5-1.2-.6" />
    </Icon>
  );
}

function BuildingIcon() {
  return (
    <Icon>
      <path d="M4.5 17V5.5A1.5 1.5 0 0 1 6 4h8a1.5 1.5 0 0 1 1.5 1.5V17M2.5 17h15M7.5 7.5h2m-2 3h2m-2 3h2m3-6h2m-2 3h2m-2 3h2" />
    </Icon>
  );
}

function UsersIcon() {
  return (
    <Icon>
      <path d="M7.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM12.5 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM3 16.5c.4-2.2 2.2-3.5 4.5-3.5s4.1 1.3 4.5 3.5M12 13.2c1.7-.2 3.2.7 3.8 2.3" />
    </Icon>
  );
}

function LogoutIcon() {
  return (
    <Icon>
      <path d="M12.5 10H4M8 6.5 4 10l4 3.5M9 4h5.5A1.5 1.5 0 0 1 16 5.5v9A1.5 1.5 0 0 1 14.5 16H9" />
    </Icon>
  );
}
