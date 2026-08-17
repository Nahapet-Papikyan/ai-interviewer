import { Footer } from "@/components/landing/Footer";
import { Header } from "@/components/landing/Header";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="landing min-h-screen bg-ink text-cloud">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[60] focus:rounded-full focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>
      <Header />
      <div id="main">{children}</div>
      <Footer />
    </div>
  );
}
