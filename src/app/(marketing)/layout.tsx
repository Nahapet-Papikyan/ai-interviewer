import { Footer } from "@/components/landing/Footer";
import { Header } from "@/components/landing/Header";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="landing min-h-screen bg-ink text-cloud">
      <Header />
      <main id="main">{children}</main>
      <Footer />
    </div>
  );
}
