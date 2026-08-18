import Link from "next/link";

type Props = {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
  onClick?: () => void;
};

const styles = {
  primary:
    "bg-brand text-white hover:bg-[#3b9bff] shadow-[0_0_0_1px_rgb(22_135_248_/_0.4),0_8px_24px_rgb(22_135_248_/_0.18)]",
  secondary: "border border-white/12 bg-white/[0.03] text-cloud hover:bg-white/6",
  ghost: "text-mist hover:text-cloud",
};

export function CtaLink({ href, children, variant = "primary", className = "", onClick }: Props) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`inline-flex w-fit shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full px-5 py-2.5 text-center text-sm font-medium transition-colors ${styles[variant]} ${className}`}
    >
      {children}
    </Link>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold tracking-[0.18em] text-brand uppercase">{children}</p>
  );
}

export function Section({
  id,
  children,
  className = "",
}: {
  id?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`scroll-mt-24 px-5 py-20 sm:px-8 md:py-28 ${className}`}>
      <div className="mx-auto w-full max-w-6xl">{children}</div>
    </section>
  );
}

export function FlowChips({ items }: { items: readonly string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium tracking-wide text-mist">
      {items.map((item, index) => (
        <span key={`${item}-${index}`} className="inline-flex items-center gap-1.5">
          {index > 0 ? <span className="text-brand/70">→</span> : null}
          <span className="rounded-md border border-white/10 bg-white/4 px-2 py-1 text-cloud/90">{item}</span>
        </span>
      ))}
    </div>
  );
}
