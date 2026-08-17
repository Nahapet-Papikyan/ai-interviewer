import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function InterviewLayout({ children }: { children: React.ReactNode }) {
  return <div className="landing min-h-screen bg-ink text-cloud">{children}</div>;
}
