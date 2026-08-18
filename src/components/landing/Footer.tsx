import Link from "next/link";
import { BrandLogo } from "@/components/brand/Logo";
import { Reveal } from "@/components/landing/motion";
import { SITE_CONTACT, SITE_NAME } from "@/lib/site";

const links = [
  { href: "/#solutions", label: "Solutions" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/assessment", label: "Assessment" },
  { href: "#contact", label: "Contact" },
];

export function Footer() {
  return (
    <footer id="contact" className="border-t border-white/10 px-5 py-12 sm:px-8">
      <Reveal>
        <div className="mx-auto flex max-w-6xl flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm">
            <div className="inline-flex items-center gap-2.5">
              <BrandLogo size={28} alt="" />
              <span className="text-sm font-medium text-cloud/85">{SITE_NAME}</span>
            </div>
            <p className="mt-4 text-sm leading-6 text-mist">
              Business process automation built around how your company actually works.
            </p>
            <a href={`mailto:${SITE_CONTACT}`} className="mt-4 inline-block text-sm text-cloud/80 hover:text-cloud">
              {SITE_CONTACT}
            </a>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-mist">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-cloud">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </Reveal>
    </footer>
  );
}
