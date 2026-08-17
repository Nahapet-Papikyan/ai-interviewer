"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { OpenAIRealtimeWebRTC, RealtimeAgent, RealtimeSession, tool } from "@openai/agents/realtime";
import { z } from "zod";
import { BrandLogo } from "@/components/brand/Logo";
import { MicPrompt } from "@/components/interview/MicPrompt";
import { VoiceOrb, type VoiceLevels } from "@/components/interview/VoiceOrb";

type Turn = { role: "user" | "assistant" | "system" | "tool"; content: string };

type Props = {
  token: string;
  firstName: string;
  companyName: string;
  role: string;
  alreadyConsented: boolean;
  existingTurns: Turn[];
  language?: string;
};

function extractTurns(history: unknown[]): Turn[] {
  const turns: Turn[] = [];
  for (const item of history) {
    if (!item || typeof item !== "object") continue;
    const rec = item as {
      type?: string;
      role?: string;
      content?: Array<{ type?: string; text?: string; transcript?: string }>;
    };
    if (rec.type !== "message") continue;
    const role = rec.role === "assistant" || rec.role === "user" ? rec.role : null;
    if (!role) continue;
    const content = (rec.content ?? [])
      .map((part) => part.transcript || part.text || "")
      .filter(Boolean)
      .join(" ")
      .trim();
    if (content) turns.push({ role, content });
  }
  return turns;
}

function mergeTurns(previous: Turn[], incoming: Turn[]): Turn[] {
  if (incoming.length === 0) return previous;
  if (previous.length === 0) return incoming;

  if (incoming.length >= previous.length) {
    return incoming.map((turn, index) => {
      const prior = previous[index];
      if (!prior || prior.role !== turn.role) return turn;
      return prior.content.length > turn.content.length ? prior : turn;
    });
  }

  const next = [...previous];
  const lastIncoming = incoming[incoming.length - 1];
  const lastLocal = next[next.length - 1];
  if (!lastIncoming || !lastLocal) return next;
  if (lastIncoming.role === lastLocal.role && lastIncoming.content.length > lastLocal.content.length) {
    next[next.length - 1] = lastIncoming;
  } else if (
    lastIncoming.role !== lastLocal.role &&
    !next.some((turn) => turn.role === lastIncoming.role && turn.content === lastIncoming.content)
  ) {
    next.push(lastIncoming);
  }
  return next;
}

async function sessionAction(token: string, action: string, extra: Record<string, unknown> = {}) {
  const res = await fetch("/api/interviews/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ interviewToken: token, action, ...extra }),
  });
  if (!res.ok) {
    throw new Error("Session update failed");
  }
  return res.json();
}

function readRms(analyser: AnalyserNode, buffer: Uint8Array<ArrayBuffer>) {
  analyser.getByteTimeDomainData(buffer);
  let sum = 0;
  for (let i = 0; i < buffer.length; i += 1) {
    const v = (buffer[i] - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / buffer.length);
}

function statusCopy(status: "idle" | "connecting" | "live" | "text" | "ended" | "error") {
  switch (status) {
    case "live":
      return "Կապը հաստատված է";
    case "connecting":
      return "Միանում է…";
    case "text":
      return "Տեքստային ռեժիմ";
    case "error":
      return "Ձայնը չհաջողվեց";
    default:
      return "Պատրաստ է";
  }
}

export function InterviewClient({
  token,
  firstName,
  companyName,
  role,
  alreadyConsented,
  existingTurns,
  language = "hy",
}: Props) {
  const [consented, setConsented] = useState(alreadyConsented);
  const [status, setStatus] = useState<"idle" | "connecting" | "live" | "text" | "ended" | "error">("idle");
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState("");
  const [turns, setTurns] = useState<Turn[]>(existingTurns);
  const [textInput, setTextInput] = useState("");
  const sessionRef = useRef<RealtimeSession | null>(null);
  const reconnects = useRef(0);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const levelsRef = useRef<VoiceLevels>({ user: 0, ai: 0 });
  const mutedRef = useRef(false);
  const audioCleanupRef = useRef<(() => void) | null>(null);
  const persistTimerRef = useRef<number | null>(null);
  const latestTurnsRef = useRef<Turn[]>(existingTurns);
  const connectingRef = useRef(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const userMutedRef = useRef(false);
  const aiSpeakingRef = useRef(false);
  const aiHoldTimerRef = useRef<number | null>(null);
  const listeningOpenRef = useRef(false);
  const introPendingRef = useRef(false);
  const introFallbackRef = useRef<number | null>(null);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [userMuted, setUserMuted] = useState(false);
  const [listeningOpen, setListeningOpen] = useState(false);
  const [micDenied, setMicDenied] = useState(false);
  mutedRef.current = muted || aiSpeaking || !listeningOpenRef.current;

  function applyMicGate() {
    const off = userMutedRef.current || aiSpeakingRef.current || !listeningOpenRef.current;
    sessionRef.current?.mute(off);
    mediaStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !off;
    });
    setMuted((prev) => (prev === off ? prev : off));
  }

  function clearInputAudio() {
    try {
      sessionRef.current?.transport.sendEvent({ type: "input_audio_buffer.clear" });
    } catch {
      // data channel may not be open yet
    }
  }

  function setVadAutoResponse(enabled: boolean) {
    try {
      sessionRef.current?.transport.sendEvent({
        type: "session.update",
        session: {
          type: "realtime",
          audio: {
            input: {
              turn_detection: {
                type: "semantic_vad",
                eagerness: "medium",
                create_response: enabled,
                interrupt_response: false,
              },
              transcription: {
                model: "gpt-live-transcribe",
                language: "hy",
              },
            },
          },
        },
      });
    } catch {
      // data channel may not be open yet
    }
  }

  function openListening() {
    if (listeningOpenRef.current) return;
    clearInputAudio();
    listeningOpenRef.current = true;
    setListeningOpen(true);
    setVadAutoResponse(true);
    applyMicGate();
  }

  function beginAiSpeech() {
    if (aiHoldTimerRef.current) {
      window.clearTimeout(aiHoldTimerRef.current);
      aiHoldTimerRef.current = null;
    }
    if (aiSpeakingRef.current) return;
    aiSpeakingRef.current = true;
    setAiSpeaking(true);
    applyMicGate();
  }

  function endAiSpeech() {
    if (!aiSpeakingRef.current || aiHoldTimerRef.current) return;
    aiHoldTimerRef.current = window.setTimeout(() => {
      aiHoldTimerRef.current = null;
      aiSpeakingRef.current = false;
      setAiSpeaking(false);
      if (introPendingRef.current) {
        introPendingRef.current = false;
        openListening();
        return;
      }
      applyMicGate();
    }, 400);
  }

  function toggleUserMic() {
    if (aiSpeakingRef.current || !listeningOpenRef.current) return;
    userMutedRef.current = !userMutedRef.current;
    setUserMuted(userMutedRef.current);
    applyMicGate();
  }

  function continueWithText() {
    setMicDenied(false);
    setStatus("text");
    setError("");
  }

  const tools = useMemo(
    () => [
      tool({
        name: "record_process_candidate",
        description: "Mark a promising recurring process. Provisional, not final analysis.",
        parameters: z.object({
          name: z.string(),
          short_reason: z.string(),
        }),
        async execute({ name, short_reason }) {
          await sessionAction(token, "process", { name, shortReason: short_reason });
          return "Recorded process candidate.";
        },
      }),
      tool({
        name: "record_key_fact",
        description: "Store a critical volume/time/people/system/error/impact/pilot fact.",
        parameters: z.object({
          category: z.enum(["volume", "time", "people", "system", "error", "impact", "pilot"]),
          value: z.string(),
          process_name: z.string(),
          evidence_summary: z.string(),
        }),
        async execute({ category, value, process_name, evidence_summary }) {
          await sessionAction(token, "fact", {
            category,
            value,
            processName: process_name,
            evidenceSummary: evidence_summary,
          });
          return "Recorded key fact.";
        },
      }),
      tool({
        name: "mark_interview_complete",
        description: "Call only after closing, when the respondent has nothing more to add.",
        parameters: z.object({
          reason: z.string(),
        }),
        async execute() {
          const current = sessionRef.current;
          const historyTurns = mergeTurns(
            latestTurnsRef.current,
            current ? extractTurns(current.history as unknown[]) : [],
          );
          latestTurnsRef.current = historyTurns;
          await sessionAction(token, "complete", { turns: historyTurns });
          current?.close();
          setStatus("ended");
          return "Interview marked complete.";
        },
      }),
    ],
    [token, turns],
  );

  async function persistHistory(history: unknown[]) {
    const extracted = extractTurns(history);
    const incoming = listeningOpenRef.current ? extracted : extracted.filter((turn) => turn.role !== "user");
    const next = mergeTurns(latestTurnsRef.current, incoming);
    const unchanged =
      next.length === latestTurnsRef.current.length &&
      next.every((turn, index) => {
        const prior = latestTurnsRef.current[index];
        return prior?.role === turn.role && prior.content === turn.content;
      });
    latestTurnsRef.current = next;
    if (!unchanged) setTurns(next);
    if (next.length === 0 || incoming.length === 0) return;
    if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);
    persistTimerRef.current = window.setTimeout(() => {
      void sessionAction(token, "history", { turns: latestTurnsRef.current });
    }, 450);
  }

  async function connectVoice() {
    if (connectingRef.current) return;
    connectingRef.current = true;
    setStatus("connecting");
    setError("");
    setMicDenied(false);
    setUserMuted(false);
    setListeningOpen(false);
    userMutedRef.current = false;
    listeningOpenRef.current = false;
    try {
      audioCleanupRef.current?.();
      const mediaStreamPromise = navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      const tokenPromise = fetch("/api/realtime/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interviewToken: token }),
      });

      const mediaStream = await mediaStreamPromise;
      mediaStream.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
      mediaStreamRef.current = mediaStream;
      listeningOpenRef.current = false;
      introPendingRef.current = reconnects.current === 0;
      setMuted(true);

      const audioCtx = new AudioContext();
      await audioCtx.resume();

      const res = await tokenPromise;
      if (!res.ok) {
        mediaStream.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        void audioCtx.close();
        throw new Error("Չհաջողվեց սկսել ձայնային կապը");
      }
      const data = (await res.json()) as {
        clientSecret: string;
        model: string;
        instructions?: string;
      };

      const micAnalyser = audioCtx.createAnalyser();
      micAnalyser.fftSize = 2048;
      micAnalyser.smoothingTimeConstant = 0.7;
      audioCtx.createMediaStreamSource(mediaStream).connect(micAnalyser);

      const outAnalyser = audioCtx.createAnalyser();
      outAnalyser.fftSize = 2048;
      outAnalyser.smoothingTimeConstant = 0.65;
      const micBuffer = new Uint8Array(micAnalyser.fftSize) as Uint8Array<ArrayBuffer>;
      const outBuffer = new Uint8Array(outAnalyser.fftSize) as Uint8Array<ArrayBuffer>;

      let remoteTapped = false;
      const transport = new OpenAIRealtimeWebRTC({
        mediaStream,
        changePeerConnection: (peerConnection) => {
          peerConnection.addEventListener("track", (event) => {
            if (event.track.kind !== "audio" || remoteTapped) return;
            remoteTapped = true;
            audioCtx.createMediaStreamSource(new MediaStream([event.track])).connect(outAnalyser);
          });
          return peerConnection;
        },
      });

      const agent = new RealtimeAgent({
        name: "Business Process Discovery Interviewer",
        instructions:
          data.instructions ??
          "You are a business-process discovery interviewer. Default to հայերեն. Follow the respondent if they switch language. Use tools sparingly.",
        tools,
      });
      const session = new RealtimeSession(agent, {
        transport,
        model: data.model,
        config: {
          outputModalities: ["audio"],
          audio: {
            input: {
              turnDetection: {
                type: "semantic_vad",
                eagerness: "medium",
                createResponse: false,
                interruptResponse: false,
              },
              transcription: {
                model: "gpt-live-transcribe",
                language: "hy",
              },
            },
          },
        },
      });
      session.on("history_updated", (history) => {
        persistHistory(history as unknown[]).catch(() => undefined);
      });
      session.on("error", () => {
        void attemptReconnect();
      });
      session.on("audio_start", () => {
        if (introFallbackRef.current) {
          window.clearTimeout(introFallbackRef.current);
          introFallbackRef.current = null;
        }
        levelsRef.current.ai = Math.max(levelsRef.current.ai, 0.32);
        beginAiSpeech();
      });
      session.on("audio_stopped", () => {
        levelsRef.current.ai *= 0.15;
        endAiSpeech();
      });
      session.on("audio_interrupted", () => {
        levelsRef.current.ai = 0;
        endAiSpeech();
      });
      session.on("transport_event", (event) => {
        if (!listeningOpenRef.current) {
          if (
            event.type === "input_audio_buffer.speech_started" ||
            event.type === "input_audio_buffer.speech_stopped" ||
            event.type === "input_audio_buffer.committed"
          ) {
            clearInputAudio();
          }
          return;
        }
        if (event.type === "input_audio_buffer.speech_started") {
          levelsRef.current.user = Math.max(levelsRef.current.user, 0.26);
        }
        if (event.type === "input_audio_buffer.speech_stopped") {
          levelsRef.current.user *= 0.12;
        }
      });
      await session.connect({ apiKey: data.clientSecret });
      sessionRef.current = session;
      session.mute(true);
      mediaStream.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
      clearInputAudio();
      if (reconnects.current === 0) {
        beginAiSpeech();
        const speakIn = language === "en" ? "English" : "հայերեն";
        const greet = language === "en"
          ? firstName
            ? `Start with "Hello, ${firstName}".`
            : "Greet them without using a name."
          : firstName
            ? `Start with "Բարև, ${firstName}".`
            : "Greet them without using a name.";
        session.transport.sendEvent({
          type: "response.create",
          response: {
            instructions: `The respondent just enabled the microphone and is listening. Speak first now, in ${speakIn}. ${greet} Use the given name "${firstName}" if provided — never the word "անուն" or "name". Briefly introduce yourself as an AI interviewer, thank them, say this is not a sales call, you want to understand recurring time-consuming processes, it usually takes 15–20 minutes, they should not share passwords or personal customer data, then ask if you may begin. A few short sentences only. Do not wait for them to speak.`,
          },
        });
        introFallbackRef.current = window.setTimeout(() => {
          if (!introPendingRef.current) return;
          introPendingRef.current = false;
          aiSpeakingRef.current = false;
          setAiSpeaking(false);
          openListening();
        }, 8000);
      } else {
        openListening();
      }

      let raf = 0;
      const pump = () => {
        const aiLevel = Math.min(1, readRms(outAnalyser, outBuffer) * 5.8);
        if (aiLevel > 0.06) beginAiSpeech();
        else if (aiLevel < 0.02 && !introPendingRef.current) endAiSpeech();
        levelsRef.current = {
          user: mutedRef.current ? 0 : Math.min(1, readRms(micAnalyser, micBuffer) * 3.0),
          ai: aiLevel,
        };
        raf = requestAnimationFrame(pump);
      };
      raf = requestAnimationFrame(pump);
      audioCleanupRef.current = () => {
        cancelAnimationFrame(raf);
        if (aiHoldTimerRef.current) window.clearTimeout(aiHoldTimerRef.current);
        if (introFallbackRef.current) window.clearTimeout(introFallbackRef.current);
        listeningOpenRef.current = false;
        introPendingRef.current = false;
        setListeningOpen(false);
        mediaStream.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        void audioCtx.close();
      };

      setStatus("live");
    } catch (err) {
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setMicDenied(true);
        setStatus("idle");
        setError("");
        return;
      }
      if (name === "NotFoundError") {
        setError("Խոսափող չի գտնվել այս սարքում։ Կարող եք շարունակել տեքստով։");
        setStatus("text");
        return;
      }
      setError(err instanceof Error ? err.message : "Կապը չհաջողվեց");
      setStatus("error");
    } finally {
      connectingRef.current = false;
    }
  }

  async function attemptReconnect() {
    if (reconnects.current >= 1) {
      setStatus("text");
      setError("Ձայնային կապը ընդհատվեց։ Կարող եք շարունակել տեքստով։");
      return;
    }
    reconnects.current += 1;
    sessionRef.current?.close();
    sessionRef.current = null;
    audioCleanupRef.current?.();
    audioCleanupRef.current = null;
    await connectVoice();
  }

  async function acceptConsent() {
    await sessionAction(token, "consent");
    setConsented(true);
  }

  async function endInterview() {
    const historyTurns = mergeTurns(
      latestTurnsRef.current,
      sessionRef.current ? extractTurns(sessionRef.current.history as unknown[]) : [],
    );
    latestTurnsRef.current = historyTurns;
    if (persistTimerRef.current) {
      window.clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    }
    await sessionAction(token, "complete", { turns: historyTurns });
    sessionRef.current?.close();
    sessionRef.current = null;
    audioCleanupRef.current?.();
    audioCleanupRef.current = null;
    setStatus("ended");
  }

  async function sendText() {
    const content = textInput.trim();
    if (!content) return;
    setTextInput("");
    if (sessionRef.current && status === "live") {
      sessionRef.current.sendMessage(content);
      return;
    }
    await sessionAction(token, "text", { content });
    setTurns((prev) => [...prev, { role: "user", content }]);
  }

  useEffect(() => {
    return () => {
      if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);
      sessionRef.current?.close();
      audioCleanupRef.current?.();
    };
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [turns, status]);

  if (!consented) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
        <BrandLogo size={72} priority className="mb-6" />
        <p className="text-sm text-zinc-500">{companyName}</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Բարև, {firstName}</h1>
        <div className="mt-6 space-y-3 text-[15px] leading-7 text-zinc-700">
          <p>
            Սա արհեստական բանականությամբ աշխատող հարցազրույց է՝ հասկանալու կրկնվող
            գործընթացները, որոնք ժամանակ են խլում {companyName}-ում։ Սա վաճառքի զանգ չէ։
          </p>
          <p>Սովորաբար տևում է 15–20 րոպե։ Դուք նշված եք որպես {role}։</p>
          <ul className="space-y-2 rounded-2xl border border-zinc-200 bg-white p-4 text-sm">
            <li>Պահվում է խոսակցության տեքստը և կառուցվածքային եզրակացությունները։</li>
            <li>Հում աուդիո չի պահվում։</li>
            <li>Խնդրում ենք չկիսել գաղտնաբառեր, հաճախորդների տվյալներ կամ բանկային տվյալներ։</li>
          </ul>
        </div>
        <button className="btn mt-8 h-11 px-5" type="button" onClick={acceptConsent}>
          Համաձայն եմ և սկսել
        </button>
      </div>
    );
  }

  if (status === "ended") {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
        <BrandLogo size={72} className="mb-6" />
        <h1 className="text-2xl font-semibold tracking-tight">Շնորհակալություն, {firstName}</h1>
        <p className="mt-3 text-[15px] leading-7 text-zinc-600">
          Հարցազրույցն ավարտված է։ Կարող եք փակել այս էջը։
        </p>
      </div>
    );
  }

  const meta = statusCopy(status);
  const visibleTurns = turns.filter((turn) => turn.role === "user" || turn.role === "assistant");
  const lastTurn = visibleTurns[visibleTurns.length - 1];
  const showAiLiveDots = status === "live" && aiSpeaking && lastTurn?.role !== "assistant";
  const voiceMode = status === "connecting" ? "connecting" : status === "live" ? "live" : "idle";
  const showMicPrompt = visibleTurns.length === 0 && status !== "live";

  return (
    <div className="mx-auto flex h-dvh max-w-2xl flex-col overflow-hidden px-4 py-5 sm:px-6">
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-zinc-200 pb-4">
        <div className="flex min-w-0 items-start gap-3">
          <BrandLogo size={40} priority />
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight">{companyName}</h1>
            <div className="mt-1 flex items-center gap-2 text-sm text-zinc-500">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  status === "live" ? "bg-emerald-500" : status === "connecting" ? "bg-amber-400" : "bg-zinc-300"
                }`}
              />
              <span>{meta}</span>
              <span className="text-zinc-300">·</span>
              <span>հայերեն</span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          {status === "text" || status === "error" || (status === "idle" && visibleTurns.length > 0) ? (
            <button className="btn h-9 px-3.5" type="button" onClick={() => void connectVoice()}>
              Սկսել ձայնով
            </button>
          ) : null}
          <button className="btn-secondary h-9 px-3.5" type="button" onClick={endInterview}>
            Ավարտել
          </button>
        </div>
      </header>

      {error ? (
        <p className="mt-3 shrink-0 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        {status !== "text" ? (
          <VoiceOrb
            mode={voiceMode}
            userMuted={userMuted}
            aiSpeaking={aiSpeaking}
            listeningOpen={listeningOpen}
            levelsRef={levelsRef}
            onToggleMic={status === "live" ? toggleUserMic : undefined}
            onStart={status === "idle" || status === "error" ? () => void connectVoice() : undefined}
          />
        ) : null}
        <div ref={scrollerRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4 sm:px-5">
          {showMicPrompt ? (
            <div className="flex min-h-[28vh] items-center justify-center">
              <MicPrompt
                firstName={firstName}
                denied={micDenied}
                connecting={status === "connecting"}
                onEnable={() => void connectVoice()}
                onTextOnly={continueWithText}
              />
            </div>
          ) : (
            visibleTurns.map((turn, index) => {
              const isUser = turn.role === "user";
              const isLiveAssistant = !isUser && aiSpeaking && index === visibleTurns.length - 1;
              return (
                <div key={`${turn.role}-${index}`} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}>
                    <span className="px-1 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                      {isUser ? firstName : "Հարցազրուցավար"}
                    </span>
                    <div
                      className={`rounded-2xl px-3.5 py-2.5 text-[15px] leading-6 ${
                        isUser
                          ? "rounded-br-md bg-zinc-900 text-white"
                          : isLiveAssistant
                            ? "rounded-bl-md bg-gradient-to-br from-sky-50 to-violet-50 text-zinc-900 ring-1 ring-indigo-200/80"
                            : "rounded-bl-md bg-zinc-100 text-zinc-900"
                      }`}
                    >
                      {turn.content}
                      {isLiveAssistant ? (
                        <span className="mt-2 flex items-center gap-2 text-xs font-medium text-indigo-500">
                          <SpeakingDots />
                          խոսում է
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          {showAiLiveDots ? (
            <div className="flex justify-start">
              <div className="flex flex-col gap-1">
                <span className="px-1 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                  Հարցազրուցավար
                </span>
                <div className="rounded-2xl rounded-bl-md bg-gradient-to-br from-sky-50 to-violet-50 px-3.5 py-3 ring-1 ring-indigo-200/80">
                  <SpeakingDots />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <form
        className="mt-3 flex shrink-0 items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void sendText();
        }}
      >
        <input
          className="min-h-11 flex-1 rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-[15px] outline-none focus:border-zinc-400"
          value={textInput}
          onChange={(event) => setTextInput(event.target.value)}
          placeholder="Գրեք այստեղ, եթե ձայնը հասանելի չէ"
        />
        <button className="btn h-11 px-4" type="submit">
          Ուղարկել
        </button>
      </form>
    </div>
  );
}

function SpeakingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden>
      <span className="voice-dot" />
      <span className="voice-dot" />
      <span className="voice-dot" />
    </span>
  );
}
