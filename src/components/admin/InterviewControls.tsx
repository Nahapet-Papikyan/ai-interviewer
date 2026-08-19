"use client";

import { useState } from "react";
import { Alert, AlertDescription, Button } from "@/components/shared";

export function CopyToken({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const [copying, setCopying] = useState(false);
  const url =
    typeof window === "undefined"
      ? `/i/${token}`
      : `${window.location.origin}/i/${token}`;

  async function copy() {
    setCopying(true);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } finally {
      setCopying(false);
    }
  }

  return (
    <Alert className="border-amber-200 bg-amber-50 px-5 py-4 text-amber-950">
      <AlertDescription>
        <p className="text-[11px] font-semibold tracking-[0.12em] text-amber-800 uppercase">Invitation link — shown once</p>
        <p className="mt-2 break-all font-mono text-sm text-foreground">{url}</p>
        <Button className="mt-3" type="button" onClick={copy} loading={copying}>
          {copied ? "Copied" : "Copy link"}
        </Button>
      </AlertDescription>
    </Alert>
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
    <Button
      variant={compact ? "outline" : "outline"}
      size={compact ? "sm" : "lg"}
      className={compact ? "h-8 rounded-full px-3 text-xs" : undefined}
      type="button"
      onClick={run}
      disabled={disabled || state === "running"}
      loading={state === "running"}
    >
      {label}
    </Button>
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
