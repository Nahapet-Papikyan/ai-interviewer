import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_Armenian } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoArmenian = Noto_Sans_Armenian({
  variable: "--font-armenian",
  subsets: ["armenian"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Business Discovery Voice Agent",
  description: "Internal customer discovery interviews for Armenian companies",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="hy"
      className={`${geistSans.variable} ${geistMono.variable} ${notoArmenian.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-zinc-50 text-zinc-950">{children}</body>
    </html>
  );
}
