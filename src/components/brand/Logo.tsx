import Image from "next/image";

type Props = {
  size?: number;
  className?: string;
  priority?: boolean;
  alt?: string;
};

export function BrandLogo({ size = 36, className = "", priority = false, alt = "Business Research" }: Props) {
  return (
    <Image
      src="/brand.png"
      alt={alt}
      width={size}
      height={size}
      priority={priority}
      className={`shrink-0 ${className}`}
    />
  );
}

export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <BrandLogo size={size} alt="" />
      <span className="text-sm font-semibold tracking-tight">Discovery Engine</span>
    </span>
  );
}
