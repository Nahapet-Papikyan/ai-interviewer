import { AdminSidebar } from "@/components/admin/Sidebar";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin min-h-screen">
      <AdminSidebar />
      <div className="lg:pl-[260px]">
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
