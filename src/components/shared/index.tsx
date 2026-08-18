import Link from "next/link";
import type { InterviewStatus } from "@prisma/client";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Avatar as UiAvatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb as UiBreadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
} from "@/components/ui/breadcrumb";
import { Button as UiButton, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead as UiTableHead,
  TableHeader,
  TableRow as UiTableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

export { FormSelect } from "@/components/shared/form-select";
export { Checkbox } from "@/components/ui/checkbox";
export { Switch } from "@/components/ui/switch";
export { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
export {
  Alert,
  AlertDescription,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  FieldLabel,
  Input,
  Textarea,
  buttonVariants,
};

const controlClass =
  "h-10 rounded-xl bg-background px-3 text-sm shadow-none md:text-sm";

export function Button({
  className,
  size = "lg",
  ...props
}: React.ComponentProps<typeof UiButton>) {
  return <UiButton size={size} className={cn("rounded-full px-4", className)} {...props} />;
}

export function ButtonAnchor({
  href,
  className,
  variant = "outline",
  size = "lg",
  children,
}: {
  href: string;
  className?: string;
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive" | "link";
  size?: "default" | "xs" | "sm" | "lg" | "icon";
  children: React.ReactNode;
}) {
  return (
    <a href={href} className={cn(buttonVariants({ variant, size }), "rounded-full px-4", className)}>
      {children}
    </a>
  );
}

export function ButtonLink({
  href,
  className,
  variant = "default",
  size = "lg",
  children,
}: {
  href: string;
  className?: string;
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive" | "link";
  size?: "default" | "xs" | "sm" | "lg" | "icon";
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={cn(buttonVariants({ variant, size }), "rounded-full px-4", className)}>
      {children}
    </Link>
  );
}

export function FormField({
  label,
  htmlFor,
  className,
  labelClassName,
  children,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  className?: string;
  labelClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <Field className={className}>
      <FieldLabel htmlFor={htmlFor} className={cn("text-xs text-muted-foreground", labelClassName)}>
        {label}
      </FieldLabel>
      {children}
    </Field>
  );
}

export function TextInput({ className, ...props }: React.ComponentProps<typeof Input>) {
  return <Input className={cn(controlClass, className)} {...props} />;
}

export function TextArea({ className, ...props }: React.ComponentProps<typeof Textarea>) {
  return <Textarea className={cn("min-h-20 rounded-xl bg-background px-3 shadow-none", className)} {...props} />;
}

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
        <h1 className="text-[1.65rem] font-semibold tracking-tight text-foreground sm:text-[1.85rem]">{title}</h1>
        {description ? <div className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Breadcrumb({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <UiBreadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink render={<Link href={href} />} className="inline-flex items-center gap-1.5 text-[13px]">
            <ChevronLeft className="size-3.5" />
            {children}
          </BreadcrumbLink>
        </BreadcrumbItem>
      </BreadcrumbList>
    </UiBreadcrumb>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold tracking-[0.16em] text-primary uppercase">{children}</p>;
}

const STATUS_STYLES: Record<string, string> = {
  INVITED: "bg-zinc-100 text-zinc-600",
  OPENED: "bg-sky-50 text-sky-800",
  CONSENTED: "bg-sky-50 text-sky-800",
  STARTED: "bg-blue-50 text-blue-800",
  IN_PROGRESS: "bg-primary/10 text-primary",
  COMPLETED: "bg-violet-50 text-violet-800",
  ANALYZING: "bg-amber-50 text-amber-800",
  ANALYZED: "bg-emerald-50 text-emerald-800",
  REVIEWED: "bg-emerald-50 text-emerald-800",
  FOLLOW_UP_READY: "bg-primary/10 text-primary",
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
    <Badge variant="secondary" className={cn("h-auto px-2.5 py-1 text-[11px] tracking-wide", STATUS_STYLES[status])}>
      {formatStatus(status)}
    </Badge>
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
    brand: "bg-primary/10 text-primary",
    success: "bg-emerald-50 text-emerald-800",
    warn: "bg-amber-50 text-amber-800",
  };
  return (
    <Badge variant="secondary" className={cn("h-auto px-2.5 py-1 text-[11px]", styles[tone])}>
      {children}
    </Badge>
  );
}

export function Avatar({ name, size = "sm" }: { name: string; size?: "sm" | "md" }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <UiAvatar size={size === "md" ? "lg" : "default"} className="bg-foreground text-background">
      <AvatarFallback className="bg-foreground text-[11px] font-medium text-background">
        {initials || "?"}
      </AvatarFallback>
    </UiAvatar>
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
    <Empty className="rounded-2xl border border-dashed bg-card/60 py-16">
      <EmptyHeader>
        <EmptyTitle className="text-base">{title}</EmptyTitle>
        {description ? <EmptyDescription>{description}</EmptyDescription> : null}
      </EmptyHeader>
      {action ? <EmptyContent className="mt-1">{action}</EmptyContent> : null}
    </Empty>
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
    <Card className="gap-0 overflow-hidden py-0 ring-foreground/8">
      <Table className="text-left" style={minWidth ? { minWidth } : undefined}>
        {children}
      </Table>
    </Card>
  );
}

export function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <UiTableHead
      className={cn("px-4 py-3 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase", className)}
    >
      {children}
    </UiTableHead>
  );
}

export function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <TableCell className={cn("px-4 py-3 whitespace-normal", className)}>{children}</TableCell>;
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
    <Link href={href} className="flex min-w-0 max-w-[240px] items-center gap-3 hover:text-primary" title={name}>
      <Avatar name={name} />
      <span className="min-w-0">
        <span className="block truncate font-medium">{name}</span>
        {subtitle ? <span className="mt-0.5 block truncate text-xs font-normal text-muted-foreground">{subtitle}</span> : null}
      </span>
    </Link>
  );
}

export function Truncate({ children, className = "", title }: { children: React.ReactNode; className?: string; title?: string }) {
  return (
    <span className={cn("block max-w-[180px] truncate", className)} title={title}>
      {children}
    </span>
  );
}

export function TableAction({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex whitespace-nowrap text-sm font-medium text-primary hover:underline">
      {children}
    </Link>
  );
}

export function TableHead({ children }: { children: React.ReactNode }) {
  return (
    <TableHeader className="bg-muted/50">
      <UiTableRow className="hover:bg-transparent">{children}</UiTableRow>
    </TableHeader>
  );
}

export function TableRow({ children }: { children: React.ReactNode }) {
  return <UiTableRow>{children}</UiTableRow>;
}

export { TableBody };

export function scoreTone(value: number, max = 100) {
  const pct = max ? value / max : 0;
  if (pct >= 0.7) return { bar: "bg-primary", text: "text-primary" };
  if (pct >= 0.4) return { bar: "bg-amber-500", text: "text-amber-700" };
  return { bar: "bg-zinc-400", text: "text-zinc-500" };
}

export function ScoreBar({ value, max = 100 }: { value: number; max?: number }) {
  const width = Math.max(0, Math.min(100, (value / max) * 100));
  const tone = scoreTone(value, max);
  return (
    <div className="flex min-w-[88px] items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", tone.bar)} style={{ width: `${width}%` }} />
      </div>
      <span className={cn("w-7 text-right text-xs font-medium tabular-nums", tone.text)}>{Math.round(value)}</span>
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
  const stroke = tone.bar === "bg-primary" ? "#1687f8" : tone.bar === "bg-amber-500" ? "#f59e0b" : "#a1a1aa";
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
        <span className="text-lg font-semibold tracking-tight text-foreground tabular-nums">{Math.round(value)}</span>
        {label ? <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">{label}</span> : null}
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
    <Card className="gap-0 py-4 ring-foreground/8">
      <CardContent>
        <div className="text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">{label}</div>
        <div className="mt-2 text-2xl font-semibold tracking-tight text-foreground tabular-nums">{value}</div>
        {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
      </CardContent>
    </Card>
  );
}

export function Surface({ className, children, ...props }: React.ComponentProps<typeof Card>) {
  return (
    <Card className={cn("py-5 ring-foreground/8", className)} {...props}>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}
