"use client";

import { useEffect } from "react";
import { BrandLogo } from "@/components/brand/Logo";
import { Button } from "@/components/shared";
import { interviewCopy } from "@/lib/interview/copy";

type Props = {
  firstName: string;
  language?: string;
  connecting: boolean;
  denied: boolean;
  unavailable: boolean;
  sessionError?: string;
  onEnable: () => void;
};

export function MicPermissionModal({
  firstName,
  language,
  connecting,
  denied,
  unavailable,
  sessionError,
  onEnable,
}: Props) {
  const copy = interviewCopy(language);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") event.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const content = modalContent({ firstName, connecting, denied, unavailable, sessionError, copy });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/75 px-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mic-modal-title"
      aria-describedby="mic-modal-copy"
    >
      <div className="w-full max-w-md rounded-[1.6rem] border border-white/10 bg-ink-2 p-6 shadow-[0_24px_80px_rgb(0_0_0_/_0.45)] sm:p-8">
        <BrandLogo size={48} className="mx-auto mb-5" />
        <div className="mx-auto mb-5 flex h-16 items-end justify-center gap-1" aria-hidden>
          {[12, 22, 34, 20, 28, 16, 24].map((h, i) => (
            <span
              key={i}
              className="landing-wave w-1.5 rounded-full bg-gradient-to-t from-brand-3 to-brand"
              style={{ height: h }}
            />
          ))}
        </div>
        <h2 id="mic-modal-title" className="text-center text-xl font-semibold tracking-tight text-cloud">
          {content.title}
        </h2>
        <p id="mic-modal-copy" className="mt-3 text-center text-sm leading-6 text-mist">
          {content.body}
        </p>
        {denied ? <PermissionSteps language={language} /> : null}
        <Button className="mt-6 h-12 w-full" type="button" onClick={onEnable} disabled={connecting}>
          {content.action}
        </Button>
        <p className="mt-3 text-center text-xs leading-5 text-mist">
          {connecting ? copy.micConnectingHint : copy.micHint}
        </p>
      </div>
    </div>
  );
}

function modalContent({
  firstName,
  connecting,
  denied,
  unavailable,
  sessionError,
  copy,
}: {
  firstName: string;
  connecting: boolean;
  denied: boolean;
  unavailable: boolean;
  sessionError?: string;
  copy: ReturnType<typeof interviewCopy>;
}) {
  if (connecting) {
    return {
      title: copy.micConnectingTitle,
      body: copy.micConnectingBody,
      action: copy.micConnectingAction,
    };
  }
  if (denied) {
    return {
      title: copy.micDeniedTitle,
      body: copy.micDeniedBody,
      action: copy.micRetry,
    };
  }
  if (unavailable) {
    return {
      title: copy.micUnavailableTitle,
      body: copy.micUnavailableBody,
      action: copy.micRetry,
    };
  }
  if (sessionError) {
    return {
      title: copy.micSessionErrorTitle,
      body: sessionError,
      action: copy.micRetry,
    };
  }
  return {
    title: copy.micEnableTitle(firstName),
    body: copy.micEnableBody,
    action: copy.micEnableAction,
  };
}

function PermissionSteps({ language }: { language?: string }) {
  const copy = interviewCopy(language);
  return (
    <ol className="mt-5 space-y-2 rounded-2xl border border-white/10 bg-ink p-4 text-left text-sm leading-6 text-mist">
      <li>{copy.micStep1}</li>
      <li>{copy.micStep2}</li>
      <li>{copy.micStep3}</li>
      <li>{copy.micStep4}</li>
    </ol>
  );
}
