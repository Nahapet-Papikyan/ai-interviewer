"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import { interviewCopy } from "@/lib/interview/copy";

export type VoiceLevels = { user: number; ai: number };
export type VoiceSessionMode = "idle" | "connecting" | "live";

type Speaker = "none" | "user" | "ai";

type Props = {
  mode: VoiceSessionMode;
  userMuted: boolean;
  aiSpeaking?: boolean;
  listeningOpen?: boolean;
  language?: string;
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
  language?: string,
) {
  const copy = interviewCopy(language);
  if (mode === "connecting") return copy.orbConnecting;
  if (mode !== "live") return copy.orbIdle;
  if (aiSpeaking || speaker === "ai") return copy.orbAiSpeaking;
  if (userMuted || !listeningOpen) return copy.orbEnableMic;
  if (speaker === "user") return copy.orbYouSpeaking;
  return copy.orbListening;
}

export function VoiceOrb({
  mode,
  userMuted,
  aiSpeaking = false,
  listeningOpen = false,
  language = "hy",
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
  const languageRef = useRef(language);

  useEffect(() => {
    modeRef.current = mode;
    mutedRef.current = userMuted;
    aiSpeakingRef.current = aiSpeaking;
    listeningRef.current = listeningOpen;
    languageRef.current = language;
  }, [mode, userMuted, aiSpeaking, listeningOpen, language]);

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
    let displayEnergy = 0.12;
    let displayRadius = 0;
    let lastCaption = "";
    let stableSpeaker: Speaker = "none";
    let pendingSpeaker: Speaker = "none";
    let pendingSince = 0;
    let userHoldUntil = 0;
    let aiHoldUntil = 0;

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

    function follow(current: number, target: number, attack: number, release: number) {
      const rate = target > current ? attack : release;
      return current + (target - current) * rate;
    }

    function debounceSpeaker(next: Speaker, now: number): Speaker {
      if (stableSpeaker === "user" && next === "none" && now < userHoldUntil) return "user";
      if (stableSpeaker === "ai" && next === "none" && now < aiHoldUntil) return "ai";
      if (next === stableSpeaker) {
        pendingSpeaker = next;
        return stableSpeaker;
      }
      if (pendingSpeaker !== next) {
        pendingSpeaker = next;
        pendingSince = now;
      }
      const delay = next === "none" ? 280 : 70;
      if (now - pendingSince >= delay) stableSpeaker = next;
      return stableSpeaker;
    }

    const blobPoint = (cx: number, cy: number, radius: number, energy: number, phase: number, angle: number) => {
      const wobble =
        Math.sin(angle * 3 + time * 0.72 + phase) * 0.07 +
        Math.sin(angle * 5 - time * 0.48 + phase * 0.4) * 0.045 +
        Math.cos(angle * 2 + time * 0.32) * 0.05;
      const r = radius * (1 + wobble * (0.22 + energy * 0.38) + energy * 0.09);
      return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
    };

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
      const points = 48;
      const coords = Array.from({ length: points }, (_, i) =>
        blobPoint(cx, cy, radius, energy, phase, (i / points) * Math.PI * 2),
      );
      ctx.beginPath();
      const last = coords[coords.length - 1];
      ctx.moveTo((last.x + coords[0].x) / 2, (last.y + coords[0].y) / 2);
      for (let i = 0; i < coords.length; i += 1) {
        const current = coords[i];
        const next = coords[(i + 1) % coords.length];
        ctx.quadraticCurveTo(current.x, current.y, (current.x + next.x) / 2, (current.y + next.y) / 2);
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
      const now = performance.now();
      const user = mutedRef.current || !listeningRef.current ? 0 : levelsRef.current.user;
      const ai = levelsRef.current.ai;
      smoothUser = follow(smoothUser, user, 0.12, 0.035);
      smoothAi = follow(smoothAi, ai, 0.14, 0.04);
      time += 0.012;

      if (listeningRef.current && !mutedRef.current && smoothUser > 0.07) {
        userHoldUntil = now + 420;
      }
      if (aiSpeakingRef.current || smoothAi > 0.06) {
        aiHoldUntil = now + 380;
      }

      const rawSpeaker: Speaker =
        modeRef.current !== "live"
          ? "none"
          : aiSpeakingRef.current || smoothAi > 0.05 || now < aiHoldUntil
            ? "ai"
            : listeningRef.current && !mutedRef.current && (smoothUser > 0.05 || now < userHoldUntil)
              ? "user"
              : "none";
      const speaker = debounceSpeaker(rawSpeaker, now);

      const nextCaption = caption(
        modeRef.current,
        mutedRef.current,
        speaker,
        aiSpeakingRef.current,
        listeningRef.current,
        languageRef.current,
      );
      if (captionRef.current && nextCaption !== lastCaption) {
        captionRef.current.textContent = nextCaption;
        lastCaption = nextCaption;
      }

      const connecting = modeRef.current === "connecting";
      const idle = modeRef.current === "idle";
      const muted = modeRef.current === "live" && (mutedRef.current || !listeningRef.current) && speaker !== "ai";
      const targetEnergy =
        connecting || idle
          ? 0.14 + Math.sin(time * 0.9) * 0.04
          : speaker === "ai"
            ? Math.min(0.78, 0.2 + smoothAi * 0.95)
            : speaker === "user"
              ? Math.min(0.72, 0.18 + smoothUser * 0.85)
              : 0.1 + Math.sin(time * 0.7) * 0.03;
      displayEnergy = follow(displayEnergy, targetEnergy, 0.08, 0.055);

      ctx.clearRect(0, 0, width, height);
      const cx = width / 2;
      const cy = height / 2;
      const targetRadius = Math.min(width, height) * (muted ? 0.26 : 0.3);
      displayRadius = displayRadius ? follow(displayRadius, targetRadius, 0.08, 0.08) : targetRadius;
      const radius = displayRadius;

      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      if (muted) {
        drawBlob(cx, cy, radius, displayEnergy * 0.35, 0, "#94a3b8", "#64748b", "#33415500", 0.5);
      } else {
        const userMix = speaker === "user" ? Math.min(1, 0.35 + displayEnergy) : 0;
        const aiMix = speaker === "ai" || connecting ? Math.min(1, 0.4 + displayEnergy) : 0;
        drawBlob(
          cx - 6,
          cy - 2,
          radius * 1.02,
          displayEnergy,
          0.12,
          userMix > 0.2 ? "#7dd3fc" : "#67e8f9",
          userMix > 0.2 ? "#0ea5e9" : "#38bdf8",
          "#0369a100",
          0.72 + userMix * 0.12,
        );
        drawBlob(
          cx + 7,
          cy + 3,
          radius * 0.95,
          displayEnergy,
          1.35,
          aiMix > 0.2 ? "#c4b5fd" : "#a5b4fc",
          "#6366f1",
          "#312e8100",
          0.7 + aiMix * 0.12,
        );
        drawBlob(
          cx,
          cy + 6,
          radius * 0.88,
          displayEnergy,
          2.25,
          "#e9d5ff",
          "#a855f7",
          "#6b21a800",
          0.58 + displayEnergy * 0.12,
        );
      }

      ctx.restore();

      const sheen = ctx.createRadialGradient(cx - radius * 0.25, cy - radius * 0.3, 2, cx, cy, radius);
      sheen.addColorStop(0, "rgba(255,255,255,0.48)");
      sheen.addColorStop(0.35, "rgba(255,255,255,0.07)");
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
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col items-center border-b border-white/10 bg-ink-2/55 px-4 pb-4 pt-6 shadow-[0_12px_28px_rgb(0_0_0_/_0.35)] backdrop-blur-xl">
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
        className={`pointer-events-auto relative flex h-[222px] w-[222px] items-center justify-center sm:h-[252px] sm:w-[252px] ${
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
            <span className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full border border-white/12 bg-ink/55 text-cloud shadow-sm backdrop-blur-sm">
              <MicIcon off={mode === "live" && userMuted} />
            </span>
          </span>
        ) : null}
      </button>
      <p ref={captionRef} className="mt-1 text-center text-xs font-medium text-mist">
        {caption(mode, userMuted, "none", aiSpeaking, listeningOpen, language)}
      </p>
    </div>
  );
}

function MicIcon({ off }: { off?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.8">
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
