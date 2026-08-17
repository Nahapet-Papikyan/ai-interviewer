"use client";

import { useEffect } from "react";
import { BrandLogo } from "@/components/brand/Logo";

type Props = {
  firstName: string;
  connecting: boolean;
  denied: boolean;
  unavailable: boolean;
  sessionError?: string;
  onEnable: () => void;
};

const primary =
  "inline-flex h-12 w-full items-center justify-center rounded-full bg-brand px-5 text-sm font-medium text-white hover:bg-[#3b9bff] disabled:opacity-60";

export function MicPermissionModal({
  firstName,
  connecting,
  denied,
  unavailable,
  sessionError,
  onEnable,
}: Props) {
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

  const copy = content({ firstName, connecting, denied, unavailable, sessionError });

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
          {copy.title}
        </h2>
        <p id="mic-modal-copy" className="mt-3 text-center text-sm leading-6 text-mist">
          {copy.body}
        </p>
        {denied ? <PermissionSteps /> : null}
        <button className={`${primary} mt-6`} type="button" onClick={onEnable} disabled={connecting}>
          {copy.action}
        </button>
        {connecting ? (
          <p className="mt-3 text-center text-xs leading-5 text-mist">
            Զննարկիչը հարցնում է վերևում։ Սեղմեք Allow, որպեսզի շարունակեք։
          </p>
        ) : (
          <p className="mt-3 text-center text-xs leading-5 text-mist">
            Խոսափողը միայն հարցազրույցի ընթացքում է օգտագործվում։ Հում ձայն չի պահվում։
          </p>
        )}
      </div>
    </div>
  );
}

function content({
  firstName,
  connecting,
  denied,
  unavailable,
  sessionError,
}: {
  firstName: string;
  connecting: boolean;
  denied: boolean;
  unavailable: boolean;
  sessionError?: string;
}) {
  if (connecting) {
    return {
      title: "Թույլատրեք խոսափողը",
      body: "Սեղմեք Allow զննարկչի հարցման վրա։ Մինչև խոսափողը միացված չէ, հարցազրույցը չի սկսվի։",
      action: "Սպասում է թույլտվության…",
    };
  }
  if (denied) {
    return {
      title: "Խոսափողը արգելափակված է",
      body: "Զննարկիչը արգելել է խոսափողը այս կայքի համար։ Թույլատրեք այն կայքի կարգավորումներում, ապա սեղմեք կրկին փորձել։",
      action: "Կրկին փորձել",
    };
  }
  if (unavailable) {
    return {
      title: "Խոսափող չի գտնվել",
      body: "Միացրեք խոսափողը սարքին կամ ստուգեք, որ այն չի օգտագործվում այլ հավելվածում, ապա կրկին փորձեք։",
      action: "Կրկին փորձել",
    };
  }
  if (sessionError) {
    return {
      title: "Ձայնային կապը չհաջողվեց",
      body: sessionError,
      action: "Կրկին փորձել",
    };
  }
  return {
    title: `Միացրեք խոսափողը, ${firstName}`,
    body: "Հարցազրույցը ձայնային է։ Սեղմեք կոճակը և թույլատրեք խոսափողը, որպեսզի կարողանանք սկսել։",
    action: "Միացնել խոսափողը",
  };
}

function PermissionSteps() {
  return (
    <ol className="mt-5 space-y-2 rounded-2xl border border-white/10 bg-ink p-4 text-left text-sm leading-6 text-mist">
      <li>1. Սեղմեք կողպեքի կամ խոսափողի նշանը հասցեի տողում։</li>
      <li>2. Բացեք կայքի կարգավորումները և գտեք Microphone։</li>
      <li>3. Ընտրեք Allow, ապա վերադարձեք այստեղ և սեղմեք կրկին փորձել։</li>
      <li>4. iPhone-ում՝ Settings → Safari → Microphone, ապա թարմացրեք էջը։</li>
    </ol>
  );
}
