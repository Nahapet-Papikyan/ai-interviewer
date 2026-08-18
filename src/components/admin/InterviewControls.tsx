"use client";

import { useState } from "react";

export function CopyToken({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const url =
    typeof window === "undefined"
      ? `/i/${token}`
      : `${window.location.origin}/i/${token}`;

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
      <p className="text-[11px] font-semibold tracking-[0.12em] text-amber-800 uppercase">Invitation link — shown once</p>
      <p className="mt-2 break-all font-mono text-sm text-ink">{url}</p>
      <button className="btn mt-3" type="button" onClick={copy}>
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}

type AnalyzeProps = {
  interviewId: string;
  analyzed?: boolean;
  disabled?: boolean;
  compact?: boolean;
};

export function AnalyzeInterviewButton({
  interviewId,
  analyzed = false,
  disabled = false,
  compact = false,
}: AnalyzeProps) {
  const [state, setState] = useState<"idle" | "running" | "error">("idle");

  async function run() {
    setState("running");
    const res = await fetch("/api/analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interviewId }),
    });
    if (!res.ok) {
      setState("error");
      return;
    }
    window.location.reload();
  }

  const label =
    state === "running" ? "Analyzing…" : state === "error" ? "Retry analysis" : analyzed ? "Re-analyze" : "Analyze";

  return (
    <button
      className={
        compact
          ? "inline-flex h-8 items-center whitespace-nowrap rounded-full border border-zinc-200 bg-white px-3 text-xs font-medium text-ink hover:bg-zinc-50 disabled:opacity-50"
          : "btn-secondary"
      }
      type="button"
      onClick={run}
      disabled={disabled || state === "running"}
    >
      {label}
    </button>
  );
}

export function RerunAnalysis({
  interviewId,
  analyzed = true,
  disabled = false,
}: {
  interviewId: string;
  analyzed?: boolean;
  disabled?: boolean;
}) {
  return <AnalyzeInterviewButton interviewId={interviewId} analyzed={analyzed} disabled={disabled} />;
}
