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
    <div className="card border-amber-200 bg-amber-50">
      <p className="text-sm font-medium">Invitation link (shown once)</p>
      <p className="mt-2 break-all font-mono text-sm">{url}</p>
      <button className="btn mt-3" type="button" onClick={copy}>
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}

export function RerunAnalysis({ interviewId }: { interviewId: string }) {
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  async function run() {
    setState("running");
    const res = await fetch("/api/analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interviewId }),
    });
    setState(res.ok ? "done" : "error");
    if (res.ok) window.location.reload();
  }
  return (
    <button className="btn-secondary" type="button" onClick={run} disabled={state === "running"}>
      {state === "running" ? "Analyzing…" : "Re-run analysis"}
    </button>
  );
}
