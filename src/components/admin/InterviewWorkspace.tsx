"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/shared";

type Tab = "conversation" | "analysis";

function tabFromHash(): Tab | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash;
  if (hash === "#transcript" || hash.startsWith("#m-")) return "conversation";
  if (hash === "#analysis") return "analysis";
  return null;
}

export function InterviewWorkspace({
  defaultTab,
  conversationLabel,
  analysisLabel,
  conversation,
  analysis,
}: {
  defaultTab: Tab;
  conversationLabel: string;
  analysisLabel: string;
  conversation: React.ReactNode;
  analysis: React.ReactNode;
}) {
  const [tab, setTab] = useState<Tab>(defaultTab);

  useEffect(() => {
    function applyHash() {
      const next = tabFromHash();
      if (next) setTab(next);
    }
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);

  useEffect(() => {
    if (tab !== "conversation") return;
    const id = window.location.hash.slice(1);
    if (!id.startsWith("m-")) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [tab]);

  function select(next: Tab) {
    setTab(next);
    const hash = next === "conversation" ? "#transcript" : "#analysis";
    if (window.location.hash !== hash) {
      window.history.replaceState(null, "", hash);
    }
  }

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => {
        if (value === "analysis" || value === "conversation") select(value);
      }}
      className="space-y-4"
    >
      <div className="sticky top-14 z-20 -mx-1 bg-[#f4f6fa]/90 px-1 py-2 backdrop-blur lg:top-0">
        <TabsList className="h-auto rounded-full border border-zinc-200/80 bg-white p-1 text-zinc-500 shadow-[0_1px_2px_rgb(7_10_18_/_0.04)]">
          <TabsTrigger
            value="analysis"
            className="rounded-full px-4 py-2 text-sm font-medium data-active:bg-ink data-active:text-white data-active:shadow-none"
          >
            {analysisLabel}
          </TabsTrigger>
          <TabsTrigger
            value="conversation"
            className="rounded-full px-4 py-2 text-sm font-medium data-active:bg-ink data-active:text-white data-active:shadow-none"
          >
            {conversationLabel}
          </TabsTrigger>
        </TabsList>
      </div>
      <div hidden={tab !== "analysis"}>{analysis}</div>
      <div hidden={tab !== "conversation"}>{conversation}</div>
    </Tabs>
  );
}
