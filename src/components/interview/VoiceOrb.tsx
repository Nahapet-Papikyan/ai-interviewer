"use client";

import { useEffect, useRef, type MutableRefObject } from "react";

export type VoiceLevels = { user: number; ai: number };
export type VoiceSessionMode = "idle" | "connecting" | "live";

type Speaker = "none" | "user" | "ai";

type Props = {
  mode: VoiceSessionMode;
  userMuted: boolean;
  aiSpeaking?: boolean;
  listeningOpen?: boolean;
  levelsRef: MutableRefObject<VoiceLevels>;
  onToggleMic?: () => void;
  onStart?: () => void;
};

function caption(
  mode: VoiceSessionMode,
  userMuted: boolean,
  speaker: Speaker,
  aiSpeaking: boolean,
  listeningOpen: boolean,
) {
  if (mode === "connecting") return "Թույլատրեք խոսափողը զննարկչում";
  if (mode !== "live") return "Սեղմեք՝ խոսափողը միացնելու համար";
  if (aiSpeaking || speaker === "ai") return "Հարցազրուցավարը խոսում է";
  if (userMuted || !listeningOpen) return "Սեղմեք՝ խոսափողը միացնելու համար";
  if (speaker === "user") return "Դուք եք խոսում";
  return "Լսում է ձեզ";
}

export function VoiceOrb({
  mode,
  userMuted,
  aiSpeaking = false,
  listeningOpen = false,
  levelsRef,
  onToggleMic,
  onStart,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const captionRef = useRef<HTMLParagraphElement>(null);
  const modeRef = useRef(mode);
  const mutedRef = useRef(userMuted);
  const aiSpeakingRef = useRef(aiSpeaking);
  const listeningRef = useRef(listeningOpen);

  modeRef.current = mode;
  mutedRef.current = userMuted;
  aiSpeakingRef.current = aiSpeaking;
  listeningRef.current = listeningOpen;

  const clickable = mode === "idle" ? Boolean(onStart) : Boolean(onToggleMic) && listeningOpen && !aiSpeaking;
  const showEnableHint = mode === "idle" || (mode === "live" && (userMuted || !listeningOpen) && !aiSpeaking);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let time = 0;
    let smoothUser = 0;
    let smoothAi = 0;
    let lastCaption = "";

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const size = canvas.clientWidth;
      canvas.width = Math.max(1, Math.floor(size * dpr));
      canvas.height = Math.max(1, Math.floor(size * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const drawBlob = (
      cx: number,
      cy: number,
      radius: number,
      energy: number,
      phase: number,
      inner: string,
      mid: string,
      outer: string,
      alpha: number,
    ) => {
      const points = 56;
      ctx.beginPath();
      for (let i = 0; i <= points; i += 1) {
        const a = (i / points) * Math.PI * 2;
        const wobble =
          Math.sin(a * 3 + time * 1.15 + phase) * 0.11 +
          Math.sin(a * 5 - time * 0.85 + phase * 0.4) * 0.07 +
          Math.cos(a * 2 + time * 0.55) * 0.08;
        const r = radius * (1 + wobble * (0.42 + energy * 1.55) + energy * 0.16);
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      const gradient = ctx.createRadialGradient(
        cx - radius * 0.22,
        cy - radius * 0.28,
        radius * 0.08,
        cx,
        cy,
        radius * 1.2,
      );
      gradient.addColorStop(0, inner);
      gradient.addColorStop(0.45, mid);
      gradient.addColorStop(1, outer);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.globalAlpha = 1;
    };

    const tick = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const user = mutedRef.current || !listeningRef.current ? 0 : levelsRef.current.user;
      const ai = levelsRef.current.ai;
      smoothUser += (user - smoothUser) * 0.2;
      smoothAi += (ai - smoothAi) * 0.24;
      time += 0.016;

      const speaker: Speaker =
        modeRef.current !== "live"
          ? "none"
          : aiSpeakingRef.current || smoothAi > 0.05
            ? "ai"
            : listeningRef.current && !mutedRef.current && smoothUser > 0.06
              ? "user"
              : "none";

      const nextCaption = caption(
        modeRef.current,
        mutedRef.current,
        speaker,
        aiSpeakingRef.current,
        listeningRef.current,
      );
      if (captionRef.current && nextCaption !== lastCaption) {
        captionRef.current.textContent = nextCaption;
        lastCaption = nextCaption;
      }

      const connecting = modeRef.current === "connecting";
      const idle = modeRef.current === "idle";
      const muted = modeRef.current === "live" && (mutedRef.current || !listeningRef.current) && speaker !== "ai";
      const energy =
        connecting || idle
          ? 0.16 + Math.sin(time * 1.6) * 0.06
          : speaker === "ai"
            ? Math.min(1, 0.22 + smoothAi * 1.7)
            : speaker === "user"
              ? Math.min(1, 0.2 + smoothUser * 1.6)
              : 0.1 + Math.sin(time * 1.15) * 0.04;

      ctx.clearRect(0, 0, width, height);
      const cx = width / 2;
      const cy = height / 2;
      const radius = Math.min(width, height) * (muted ? 0.26 : 0.3);

      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      if (muted) {
        drawBlob(cx, cy, radius, energy * 0.4, 0, "#94a3b8", "#64748b", "#33415500", 0.55);
      } else if (speaker === "user") {
        drawBlob(cx - 8, cy + 4, radius * 1.02, energy, 0.2, "#7dd3fc", "#0ea5e9", "#0369a100", 0.85);
        drawBlob(cx + 6, cy - 6, radius * 0.92, energy, 1.4, "#c4b5fd", "#6366f1", "#312e8100", 0.7);
      } else if (speaker === "ai" || connecting) {
        drawBlob(cx - 10, cy - 4, radius * 1.04, energy, 0.15, "#67e8f9", "#38bdf8", "#0284c700", 0.8);
        drawBlob(cx + 8, cy + 2, radius, energy, 1.1, "#a5b4fc", "#6366f1", "#312e8100", 0.85);
        drawBlob(cx, cy + 8, radius * 0.9, energy, 2.2, "#e9d5ff", "#a855f7", "#6b21a800", 0.75);
      } else {
        drawBlob(cx - 6, cy - 2, radius, energy, 0.1, "#7dd3fc", "#38bdf8", "#0369a100", 0.7);
        drawBlob(cx + 7, cy + 4, radius * 0.94, energy, 1.6, "#c4b5fd", "#818cf8", "#312e8100", 0.72);
        drawBlob(cx, cy + 6, radius * 0.86, energy, 2.4, "#d8b4fe", "#a855f7", "#6b21a800", 0.55);
      }

      ctx.restore();

      const sheen = ctx.createRadialGradient(cx - radius * 0.25, cy - radius * 0.3, 2, cx, cy, radius);
      sheen.addColorStop(0, "rgba(255,255,255,0.55)");
      sheen.addColorStop(0.35, "rgba(255,255,255,0.08)");
      sheen.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = sheen;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.95, 0, Math.PI * 2);
      ctx.fill();

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [levelsRef]);

  function handleClick() {
    if (mode === "idle") {
      onStart?.();
      return;
    }
    onToggleMic?.();
  }

  return (
    <div className="flex shrink-0 flex-col items-center px-4 pb-2 pt-4">
      <button
        type="button"
        disabled={!clickable}
        onClick={handleClick}
        aria-label={
          mode === "idle"
            ? "Միացնել խոսափողը"
            : userMuted || !listeningOpen
              ? "Միացնել խոսափողը"
              : "Անջատել խոսափողը"
        }
        title={
          showEnableHint
            ? "Սեղմեք՝ խոսափողը միացնելու համար"
            : clickable
              ? "Սեղմեք՝ խոսափողն անջատելու համար"
              : undefined
        }
        className={`relative flex h-[148px] w-[148px] items-center justify-center sm:h-[168px] sm:w-[168px] ${
          clickable ? "cursor-pointer" : "cursor-default"
        }`}
      >
        {showEnableHint ? (
          <>
            <span className="mic-ring" />
            <span className="mic-ring mic-ring-delay" />
          </>
        ) : null}
        <canvas ref={canvasRef} className="h-full w-full" />
        {showEnableHint ? (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/80 text-zinc-800 shadow-sm backdrop-blur-sm">
              <MicIcon off={mode === "live" && userMuted} />
            </span>
          </span>
        ) : null}
      </button>
      <p ref={captionRef} className="mt-1 text-center text-xs font-medium text-zinc-600">
        {caption(mode, userMuted, "none", aiSpeaking, listeningOpen)}
      </p>
    </div>
  );
}

function MicIcon({ off }: { off?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
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
