import Link from "next/link";
import type { InterviewStatus } from "@prisma/client";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <div className="mb-2">{eyebrow}</div> : null}
        <h1 className="text-[1.65rem] font-semibold tracking-tight text-ink sm:text-[1.85rem]">{title}</h1>
        {description ? <div className="mt-1.5 max-w-2xl text-sm leading-6 text-zinc-500">{description}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Breadcrumb({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1.5 text-[13px] text-zinc-500 transition-colors hover:text-ink">
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M10 3 5 8l5 5" />
      </svg>
      {children}
    </Link>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold tracking-[0.16em] text-brand uppercase">{children}</p>
  );
}

const STATUS_STYLES: Record<string, string> = {
  INVITED: "bg-zinc-100 text-zinc-600",
  OPENED: "bg-sky-50 text-sky-800",
  CONSENTED: "bg-sky-50 text-sky-800",
  STARTED: "bg-blue-50 text-blue-800",
  IN_PROGRESS: "bg-brand/10 text-brand",
  COMPLETED: "bg-violet-50 text-violet-800",
  ANALYZING: "bg-amber-50 text-amber-800",
  ANALYZED: "bg-emerald-50 text-emerald-800",
  REVIEWED: "bg-emerald-50 text-emerald-800",
  FOLLOW_UP_READY: "bg-brand/10 text-brand",
  ABANDONED: "bg-zinc-100 text-zinc-500",
  FAILED: "bg-red-50 text-red-700",
};

export function formatStatus(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((word, index) => (index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(" ");
}

export function StatusBadge({ status }: { status: InterviewStatus | string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] leading-none font-medium tracking-wide ${
        STATUS_STYLES[status] ?? "bg-zinc-100 text-zinc-600"
      }`}
    >
      {formatStatus(status)}
    </span>
  );
}

export function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "brand" | "success" | "warn";
}) {
  const styles = {
    neutral: "bg-zinc-100 text-zinc-600",
    brand: "bg-brand/10 text-brand",
    success: "bg-emerald-50 text-emerald-800",
    warn: "bg-amber-50 text-amber-800",
  };
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] leading-none font-medium ${styles[tone]}`}
    >
      {children}
    </span>
  );
}

export function Avatar({ name, size = "sm" }: { name: string; size?: "sm" | "md" }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  const dim = size === "md" ? "h-10 w-10 text-sm" : "h-8 w-8 text-[11px]";
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-ink text-white font-medium ${dim}`}
      aria-hidden
    >
      {initials || "?"}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-white/60 px-6 py-16 text-center">
      <p className="font-medium text-ink">{title}</p>
      {description ? <p className="mt-1.5 max-w-sm text-sm text-zinc-500">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function DataTable({
  children,
  minWidth,
}: {
  children: React.ReactNode;
  minWidth?: number;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgb(7_10_18_/_0.04)]">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm" style={minWidth ? { minWidth } : undefined}>
          {children}
        </table>
      </div>
    </div>
  );
}

export function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-3 text-[11px] font-semibold tracking-[0.08em] whitespace-nowrap text-zinc-400 uppercase ${className}`}>
      {children}
    </th>
  );
}

export function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-middle ${className}`}>{children}</td>;
}

export function NameCell({
  href,
  name,
  subtitle,
}: {
  href: string;
  name: string;
  subtitle?: string;
}) {
  return (
    <Link href={href} className="flex min-w-0 max-w-[240px] items-center gap-3 hover:text-brand" title={name}>
      <Avatar name={name} />
      <span className="min-w-0">
        <span className="block truncate font-medium">{name}</span>
        {subtitle ? <span className="mt-0.5 block truncate text-xs font-normal text-zinc-400">{subtitle}</span> : null}
      </span>
    </Link>
  );
}

export function Truncate({ children, className = "", title }: { children: React.ReactNode; className?: string; title?: string }) {
  return (
    <span className={`block max-w-[180px] truncate ${className}`} title={title}>
      {children}
    </span>
  );
}

export function TableAction({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex whitespace-nowrap text-sm font-medium text-brand hover:underline">
      {children}
    </Link>
  );
}

export function TableHead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="border-b border-zinc-100 bg-[#f8fafc]">
      <tr>{children}</tr>
    </thead>
  );
}

export function TableRow({ children }: { children: React.ReactNode }) {
  return (
    <tr className="border-t border-zinc-100/90 transition-colors hover:bg-sky-50/40">
      {children}
    </tr>
  );
}

export function scoreTone(value: number, max = 100) {
  const pct = max ? value / max : 0;
  if (pct >= 0.7) return { bar: "bg-brand", text: "text-brand" };
  if (pct >= 0.4) return { bar: "bg-amber-500", text: "text-amber-700" };
  return { bar: "bg-zinc-400", text: "text-zinc-500" };
}

export function ScoreBar({ value, max = 100 }: { value: number; max?: number }) {
  const width = Math.max(0, Math.min(100, (value / max) * 100));
  const tone = scoreTone(value, max);
  return (
    <div className="flex min-w-[88px] items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
        <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${width}%` }} />
      </div>
      <span className={`w-7 text-right text-xs font-medium tabular-nums ${tone.text}`}>{Math.round(value)}</span>
    </div>
  );
}

export function ScoreRing({
  value,
  max = 100,
  size = 88,
  label,
}: {
  value: number;
  max?: number;
  size?: number;
  label?: string;
}) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value / max));
  const tone = scoreTone(value, max);
  const stroke = tone.bar === "bg-brand" ? "#1687f8" : tone.bar === "bg-amber-500" ? "#f59e0b" : "#a1a1aa";
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 88 88" className="rotate-[-90deg]">
        <circle cx="44" cy="44" r={r} fill="none" stroke="#e8edf5" strokeWidth="8" />
        <circle
          cx="44"
          cy="44"
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-semibold tabular-nums tracking-tight text-ink">{Math.round(value)}</span>
        {label ? <span className="text-[10px] font-medium tracking-wide text-zinc-400 uppercase">{label}</span> : null}
      </div>
    </div>
  );
}

export function formatDate(date: Date | string | null | undefined) {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-[0_1px_2px_rgb(7_10_18_/_0.04)]">
      <div className="text-[11px] font-semibold tracking-[0.1em] text-zinc-400 uppercase">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-ink tabular-nums">{value}</div>
      {hint ? <div className="mt-1 text-xs text-zinc-500">{hint}</div> : null}
    </div>
  );
}
