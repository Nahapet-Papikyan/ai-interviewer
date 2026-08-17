"use client";

import { useEffect, useRef } from "react";

export type VoiceLevels = { user: number; ai: number };
export type VoiceSessionMode = "idle" | "connecting" | "live";

type Props = {
  mode: VoiceSessionMode;
  muted: boolean;
  aiSpeaking?: boolean;
  levelsRef: React.MutableRefObject<VoiceLevels>;
  onToggleMic?: () => void;
};

const BAR_COUNT = 7;

function caption(
  mode: VoiceSessionMode,
  muted: boolean,
  speaker: "none" | "user" | "ai",
  aiSpeaking: boolean,
) {
  if (mode === "connecting") return "Միանում է…";
  if (mode !== "live") return "Սպասում է ձայնին";
  if (aiSpeaking || speaker === "ai") return "Հարցազրուցավարը խոսում է";
  if (muted) return "Խոսափողն անջատված է";
  if (speaker === "user") return "Դուք եք խոսում";
  return "Լսում է";
}

export function VoiceOrb({ mode, muted, aiSpeaking = false, levelsRef, onToggleMic }: Props) {
  const userBarsRef = useRef<HTMLSpanElement[]>([]);
  const aiBarsRef = useRef<HTMLSpanElement[]>([]);
  const userMicRef = useRef<HTMLDivElement>(null);
  const aiMicRef = useRef<HTMLDivElement>(null);
  const captionRef = useRef<HTMLParagraphElement>(null);
  const modeRef = useRef(mode);
  const mutedRef = useRef(muted);
  const aiSpeakingRef = useRef(aiSpeaking);

  modeRef.current = mode;
  mutedRef.current = muted;
  aiSpeakingRef.current = aiSpeaking;

  useEffect(() => {
    let raf = 0;
    let smoothUser = 0;
    let smoothAi = 0;
    let lastCaption = "";

    const tick = () => {
      const user = mutedRef.current ? 0 : levelsRef.current.user;
      const ai = levelsRef.current.ai;
      smoothUser += (user - smoothUser) * 0.22;
      smoothAi += (ai - smoothAi) * 0.26;

      const speaker: "none" | "user" | "ai" =
        modeRef.current !== "live"
          ? "none"
          : aiSpeakingRef.current || smoothAi > 0.05
            ? "ai"
            : !mutedRef.current && smoothUser > 0.06
              ? "user"
              : "none";

      const nextCaption = caption(modeRef.current, mutedRef.current, speaker, aiSpeakingRef.current);
      if (captionRef.current && nextCaption !== lastCaption) {
        captionRef.current.textContent = nextCaption;
        lastCaption = nextCaption;
      }

      const t = performance.now() / 220;
      const connecting = modeRef.current === "connecting";
      const userActive = speaker === "user";
      const aiActive = speaker === "ai";
      const userEnergy = connecting ? 0.18 + Math.sin(t) * 0.08 : Math.min(1, 0.12 + smoothUser * 1.8);
      const aiEnergy = connecting ? 0.18 + Math.cos(t) * 0.08 : Math.min(1, 0.12 + smoothAi * 1.8);

      if (userMicRef.current) {
        userMicRef.current.style.transform = `scale(${userActive ? 1.08 + smoothUser * 0.18 : 1})`;
        userMicRef.current.dataset.active = userActive ? "true" : "false";
      }
      if (aiMicRef.current) {
        aiMicRef.current.style.transform = `scale(${aiActive ? 1.08 + smoothAi * 0.18 : 1})`;
        aiMicRef.current.dataset.active = aiActive ? "true" : "false";
      }

      userBarsRef.current.forEach((bar, i) => {
        if (!bar) return;
        const wave = 0.35 + Math.abs(Math.sin(t + i * 0.55)) * userEnergy;
        bar.style.height = `${12 + wave * 28}px`;
        bar.style.opacity = userActive || connecting ? "1" : "0.35";
      });
      aiBarsRef.current.forEach((bar, i) => {
        if (!bar) return;
        const wave = 0.35 + Math.abs(Math.sin(t + i * 0.55 + 1.2)) * aiEnergy;
        bar.style.height = `${12 + wave * 28}px`;
        bar.style.opacity = aiActive || connecting ? "1" : "0.35";
      });

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [levelsRef]);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 border-b border-white/50 bg-white/55 px-4 py-3 backdrop-blur-xl">
      <div className="flex items-center justify-center gap-4">
        <MicBadge
          ref={userMicRef}
          label="Դուք"
          muted={muted}
          tone="user"
          onClick={onToggleMic}
        />
        <div className="flex h-12 items-end gap-1">
          {Array.from({ length: BAR_COUNT }, (_, i) => (
            <span
              key={`u-${i}`}
              ref={(el) => {
                if (el) userBarsRef.current[i] = el;
              }}
              className="w-1 rounded-full bg-sky-500"
              style={{ height: 12 }}
            />
          ))}
        </div>
        <div className="flex h-12 items-end gap-1">
          {Array.from({ length: BAR_COUNT }, (_, i) => (
            <span
              key={`a-${i}`}
              ref={(el) => {
                if (el) aiBarsRef.current[i] = el;
              }}
              className="w-1 rounded-full bg-indigo-500"
              style={{ height: 12 }}
            />
          ))}
        </div>
        <MicBadge ref={aiMicRef} label="AI" muted={false} tone="ai" />
      </div>
      <p ref={captionRef} className="mt-2 text-center text-xs font-medium text-zinc-700">
        {caption(mode, muted, "none", aiSpeaking)}
      </p>
    </div>
  );
}

function MicIcon({ off }: { off?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8">
      {off ? (
        <>
          <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.3V12a3 3 0 0 1-.2 1.1" />
          <path d="M12 3a3 3 0 0 1 3 3v1M19 12a7 7 0 0 1-1.7 4.6M5 12a7 7 0 0 0 7 7" />
          <path d="M12 19v2M8 21h8M4 4l16 16" />
        </>
      ) : (
        <>
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0" />
          <path d="M12 18v3M8 21h8" />
        </>
      )}
    </svg>
  );
}

function MicBadge({
  ref,
  label,
  muted,
  tone,
  onClick,
}: {
  ref: React.Ref<HTMLDivElement>;
  label: string;
  muted: boolean;
  tone: "user" | "ai";
  onClick?: () => void;
}) {
  const active =
    tone === "user"
      ? "data-[active=true]:bg-sky-600 data-[active=true]:text-white data-[active=true]:ring-4 data-[active=true]:ring-sky-300"
      : "data-[active=true]:bg-indigo-600 data-[active=true]:text-white data-[active=true]:ring-4 data-[active=true]:ring-indigo-300";
  const mutedStyle = muted && tone === "user" ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-800";
  const clickable = Boolean(onClick);

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        disabled={!clickable}
        onClick={onClick}
        className={`pointer-events-auto ${clickable ? "cursor-pointer" : "cursor-default"}`}
      >
        <div
          ref={ref}
          data-active="false"
          className={`flex h-14 w-14 items-center justify-center rounded-full border shadow-sm transition-transform duration-150 ${mutedStyle} ${active} ${
            clickable ? "hover:scale-105" : ""
          }`}
        >
          <MicIcon off={muted && tone === "user"} />
        </div>
      </button>
      <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">{label}</span>
    </div>
  );
}
