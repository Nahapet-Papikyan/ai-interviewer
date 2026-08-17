"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { OpenAIRealtimeWebRTC, RealtimeAgent, RealtimeSession, tool } from "@openai/agents/realtime";
import { z } from "zod";
import { BrandLogo } from "@/components/brand/Logo";
import { MicPermissionModal } from "@/components/interview/MicPermissionModal";
import { VoiceOrb, type VoiceLevels } from "@/components/interview/VoiceOrb";
import {
  DEFAULT_REALTIME_VOICE,
  REALTIME_TRANSCRIBE_LANGUAGE,
  REALTIME_TRANSCRIBE_PROMPT,
} from "@/lib/openai/realtime-config";

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

function isToolActivityEvent(event: unknown): boolean {
  if (!event || typeof event !== "object") return false;
  const rec = event as {
    type?: string;
    item?: { type?: string };
    response?: { output?: Array<{ type?: string }> };
  };
  if (
    rec.type === "response.function_call_arguments.delta" ||
    rec.type === "response.function_call_arguments.done"
  ) {
    return true;
  }
  if (
    (rec.type === "response.output_item.added" || rec.type === "response.output_item.done") &&
    rec.item?.type === "function_call"
  ) {
    return true;
  }
  if (rec.type === "response.done") {
    return rec.response?.output?.some((item) => item.type === "function_call") ?? false;
  }
  return false;
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
  const [micUnavailable, setMicUnavailable] = useState(false);
  const endingRef = useRef(false);
  const pendingToolsRef = useRef(0);
  const awaitingFollowUpRef = useRef(false);
  const followUpTimerRef = useRef<number | null>(null);
  const hadLiveSessionRef = useRef(false);
  mutedRef.current = muted || aiSpeaking || !listeningOpenRef.current;

  function aiTurnLocked() {
    return (
      aiSpeakingRef.current ||
      pendingToolsRef.current > 0 ||
      awaitingFollowUpRef.current ||
      endingRef.current
    );
  }

  function applyMicGate() {
    const off =
      userMutedRef.current ||
      aiSpeakingRef.current ||
      pendingToolsRef.current > 0 ||
      awaitingFollowUpRef.current ||
      !listeningOpenRef.current ||
      endingRef.current;
    try {
      sessionRef.current?.mute(off);
    } catch {
      // session may already be closed
    }
    mediaStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !off;
    });
    setMuted((prev) => (prev === off ? prev : off));
  }

  function closeSessionSoon() {
    window.setTimeout(() => {
      try {
        sessionRef.current?.close();
      } catch {
        // already closed
      }
      sessionRef.current = null;
      audioCleanupRef.current?.();
      audioCleanupRef.current = null;
    }, 400);
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
                language: REALTIME_TRANSCRIBE_LANGUAGE,
                prompt: REALTIME_TRANSCRIBE_PROMPT,
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
    if (aiSpeakingRef.current) {
      applyMicGate();
      clearInputAudio();
      return;
    }
    aiSpeakingRef.current = true;
    setAiSpeaking(true);
    applyMicGate();
    clearInputAudio();
  }

  function noteFollowUpAudioStarted() {
    awaitingFollowUpRef.current = false;
    if (followUpTimerRef.current) {
      window.clearTimeout(followUpTimerRef.current);
      followUpTimerRef.current = null;
    }
    beginAiSpeech();
  }

  function holdAiTurn(ms = 4500) {
    awaitingFollowUpRef.current = true;
    if (listeningOpenRef.current) setVadAutoResponse(false);
    beginAiSpeech();
    if (followUpTimerRef.current) window.clearTimeout(followUpTimerRef.current);
    followUpTimerRef.current = window.setTimeout(() => {
      followUpTimerRef.current = null;
      if (pendingToolsRef.current > 0) {
        holdAiTurn(ms);
        return;
      }
      awaitingFollowUpRef.current = false;
      if (listeningOpenRef.current) setVadAutoResponse(true);
      endAiSpeech();
    }, ms);
  }

  async function runWhileAiTurnHeld<T>(work: () => Promise<T>, fallback: T): Promise<T> {
    pendingToolsRef.current += 1;
    holdAiTurn();
    try {
      return await work();
    } catch {
      return fallback;
    } finally {
      pendingToolsRef.current = Math.max(0, pendingToolsRef.current - 1);
      holdAiTurn();
    }
  }

  function endAiSpeech() {
    if (!aiSpeakingRef.current || aiHoldTimerRef.current) return;
    if (pendingToolsRef.current > 0 || awaitingFollowUpRef.current) return;
    aiHoldTimerRef.current = window.setTimeout(() => {
      aiHoldTimerRef.current = null;
      if (pendingToolsRef.current > 0 || awaitingFollowUpRef.current) return;
      aiSpeakingRef.current = false;
      setAiSpeaking(false);
      clearInputAudio();
      if (introPendingRef.current) {
        introPendingRef.current = false;
        openListening();
        return;
      }
      if (listeningOpenRef.current) setVadAutoResponse(true);
      applyMicGate();
    }, 700);
  }

  function toggleUserMic() {
    if (aiTurnLocked() || !listeningOpenRef.current) return;
    userMutedRef.current = !userMutedRef.current;
    setUserMuted(userMutedRef.current);
    applyMicGate();
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
          return runWhileAiTurnHeld(async () => {
            await sessionAction(token, "process", { name, shortReason: short_reason });
            return "Recorded process candidate.";
          }, "Could not persist the process. Continue the interview.");
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
          return runWhileAiTurnHeld(async () => {
            await sessionAction(token, "fact", {
              category,
              value,
              processName: process_name,
              evidenceSummary: evidence_summary,
            });
            return "Recorded key fact.";
          }, "Could not persist the fact. Continue the interview.");
        },
      }),
      tool({
        name: "mark_interview_complete",
        description: "Call only after closing, when the respondent has nothing more to add.",
        parameters: z.object({
          reason: z.string(),
        }),
        async execute() {
          endingRef.current = true;
          applyMicGate();
          const current = sessionRef.current;
          const historyTurns = mergeTurns(
            latestTurnsRef.current,
            current ? extractTurns(current.history as unknown[]) : [],
          );
          latestTurnsRef.current = historyTurns;
          await sessionAction(token, "complete", { turns: historyTurns });
          setStatus("ended");
          closeSessionSoon();
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
    setMicUnavailable(false);
    setUserMuted(false);
    setListeningOpen(false);
    userMutedRef.current = false;
    listeningOpenRef.current = false;
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setMicUnavailable(true);
        setStatus("idle");
        return;
      }
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
      if (res.status === 409) {
        mediaStream.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        void audioCtx.close();
        endingRef.current = true;
        setStatus("ended");
        return;
      }
      if (!res.ok) {
        mediaStream.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        void audioCtx.close();
        throw new Error("Չհաջողվեց սկսել ձայնային կապը");
      }
      const data = (await res.json()) as {
        clientSecret: string;
        model: string;
        voice?: string;
        instructions?: string;
      };
      const voice = data.voice || DEFAULT_REALTIME_VOICE;

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
        voice,
        instructions:
          data.instructions ??
          "You are a business-process discovery interviewer. Speak Eastern Armenian (արևելահայերեն) as used in the Republic of Armenia. Follow the respondent if they switch language. Use tools sparingly.",
        tools,
      });
      const session = new RealtimeSession(agent, {
        transport,
        model: data.model,
        config: {
          outputModalities: ["audio"],
          voice,
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
                language: REALTIME_TRANSCRIBE_LANGUAGE,
                prompt: REALTIME_TRANSCRIBE_PROMPT,
              },
            },
            output: {
              voice,
            },
          },
        },
      });
      session.on("history_updated", (history) => {
        persistHistory(history as unknown[]).catch(() => undefined);
      });
      session.on("error", () => {
        if (endingRef.current) return;
        if (pendingToolsRef.current > 0 || awaitingFollowUpRef.current) return;
        void attemptReconnect();
      });
      session.on("audio_start", () => {
        if (introFallbackRef.current) {
          window.clearTimeout(introFallbackRef.current);
          introFallbackRef.current = null;
        }
        levelsRef.current.ai = Math.max(levelsRef.current.ai, 0.32);
        noteFollowUpAudioStarted();
      });
      session.on("audio_stopped", () => {
        levelsRef.current.ai *= 0.15;
        endAiSpeech();
      });
      session.on("audio_interrupted", () => {
        levelsRef.current.ai = 0;
        beginAiSpeech();
        clearInputAudio();
      });
      session.on("transport_event", (event) => {
        if (event.type === "response.created") {
          beginAiSpeech();
        }
        if (event.type === "output_audio_buffer.started") {
          noteFollowUpAudioStarted();
        }
        if (isToolActivityEvent(event)) {
          holdAiTurn();
        }
        const ignoreUserAudio =
          !listeningOpenRef.current ||
          aiSpeakingRef.current ||
          pendingToolsRef.current > 0 ||
          awaitingFollowUpRef.current ||
          endingRef.current;
        if (ignoreUserAudio) {
          if (
            event.type === "input_audio_buffer.speech_started" ||
            event.type === "input_audio_buffer.speech_stopped" ||
            event.type === "input_audio_buffer.committed"
          ) {
            clearInputAudio();
            applyMicGate();
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
        const speakIn =
          language === "en"
            ? "English"
            : "Eastern Armenian (արևելահայերեն) as spoken in Yerevan and the Republic of Armenia — not Western Armenian";
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
            instructions: `The respondent just enabled the microphone and is listening. Speak first now, in ${speakIn}. ${greet} Use the given name "${firstName}" if provided — never the word "անուն" or "name". Briefly introduce yourself as an AI interviewer, thank them, say you want to understand recurring time-consuming processes, it usually takes 15–20 minutes, then say: «Խնդրում եմ չկիսվել բիզնեսի գաղտնիքներով կամ հաճախորդների անձնական տվյալներով։ Կարող ե՞մ սկսենք հիմա։» Do not say this is a sales call or that it is not a sales call. Do not mention passwords or գաղտնաբառեր. A few short sentences only. Do not wait for them to speak.`,
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
        else if (
          aiLevel < 0.02 &&
          !introPendingRef.current &&
          pendingToolsRef.current === 0 &&
          !awaitingFollowUpRef.current
        ) {
          endAiSpeech();
        }
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
        if (followUpTimerRef.current) window.clearTimeout(followUpTimerRef.current);
        awaitingFollowUpRef.current = false;
        pendingToolsRef.current = 0;
        listeningOpenRef.current = false;
        introPendingRef.current = false;
        setListeningOpen(false);
        mediaStream.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        void audioCtx.close();
      };

      hadLiveSessionRef.current = true;
      setStatus("live");
    } catch (err) {
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") {
        setMicDenied(true);
        setStatus("idle");
        setError("");
        return;
      }
      if (name === "NotFoundError" || name === "NotReadableError" || name === "OverconstrainedError") {
        setMicUnavailable(true);
        setStatus("idle");
        setError("");
        return;
      }
      setError(err instanceof Error ? err.message : "Կապը չհաջողվեց");
      setStatus("error");
    } finally {
      connectingRef.current = false;
    }
  }

  async function attemptReconnect() {
    if (endingRef.current) return;
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
    endingRef.current = true;
    applyMicGate();
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
    if (!consented || typeof navigator === "undefined" || !navigator.permissions?.query) return;
    let permission: PermissionStatus | null = null;
    function sync() {
      if (!permission) return;
      if (permission.state === "denied") {
        setMicDenied(true);
        setMicUnavailable(false);
      } else if (permission.state === "granted") {
        setMicDenied(false);
      }
    }
    void navigator.permissions
      .query({ name: "microphone" as PermissionName })
      .then((result) => {
        permission = result;
        sync();
        result.addEventListener("change", sync);
      })
      .catch(() => {
        // Safari and some browsers do not expose microphone permission state.
      });
    return () => {
      permission?.removeEventListener("change", sync);
    };
  }, [consented]);

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
      <div className="relative mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgb(22_135_248_/_0.14),transparent_48%)]"
        />
        <div className="relative">
          <BrandLogo size={72} priority className="mb-6" />
          <p className="text-[11px] font-semibold tracking-[0.18em] text-brand uppercase">{companyName}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-cloud">Բարև, {firstName}</h1>
          <div className="mt-6 space-y-3 text-[15px] leading-7 text-mist">
            <p>
              Սա արհեստական բանականությամբ աշխատող հարցազրույց է՝ հասկանալու կրկնվող
              գործընթացները, որոնք ժամանակ են խլում {companyName}-ում։
            </p>
            <p>Սովորաբար տևում է 15–20 րոպե։ Դուք նշված եք որպես {role}։</p>
            <ul className="space-y-2 rounded-2xl border border-white/10 bg-ink-2 p-4 text-sm text-cloud/90">
              <li>Պահվում է խոսակցության տեքստը և կառուցվածքային եզրակացությունները։</li>
              <li>Հում աուդիո չի պահվում։</li>
              <li>Խնդրում ենք չկիսել բիզնեսի գաղտնիքներ կամ հաճախորդների անձնական տվյալներ։</li>
            </ul>
          </div>
          <button
            className="mt-8 inline-flex h-11 items-center justify-center rounded-full bg-brand px-5 text-sm font-medium text-white hover:bg-[#3b9bff]"
            type="button"
            onClick={acceptConsent}
          >
            Համաձայն եմ և սկսել
          </button>
        </div>
      </div>
    );
  }

  if (status === "ended") {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
        <BrandLogo size={72} className="mb-6" />
        <h1 className="text-3xl font-semibold tracking-tight text-cloud">Շնորհակալություն, {firstName}</h1>
        <p className="mt-3 text-[15px] leading-7 text-mist">Հարցազրույցն ավարտված է։ Կարող եք փակել այս էջը։</p>
      </div>
    );
  }

  const meta = statusCopy(status);
  const visibleTurns = turns.filter((turn) => turn.role === "user" || turn.role === "assistant");
  const lastTurn = visibleTurns[visibleTurns.length - 1];
  const showAiLiveDots = status === "live" && aiSpeaking && lastTurn?.role !== "assistant";
  const voiceMode = status === "connecting" ? "connecting" : status === "live" ? "live" : "idle";
  const showMicGate =
    status === "idle" ||
    status === "error" ||
    (status === "connecting" && !hadLiveSessionRef.current);

  return (
    <div className="relative mx-auto flex h-dvh max-w-2xl flex-col overflow-hidden px-4 py-5 sm:px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgb(22_135_248_/_0.12),transparent_46%)]"
      />
      <header className="relative flex shrink-0 items-start justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex min-w-0 items-start gap-3">
          <BrandLogo size={36} priority />
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-medium tracking-tight text-cloud">{companyName}</h1>
            <div className="mt-1 flex items-center gap-2 text-sm text-mist">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  status === "live" ? "bg-emerald-400" : status === "connecting" ? "bg-amber-400" : "bg-white/25"
                }`}
              />
              <span>{meta}</span>
              <span className="text-white/20">·</span>
              <span>հայերեն</span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            className="inline-flex h-9 items-center rounded-full border border-white/12 bg-white/[0.03] px-3.5 text-sm font-medium text-cloud hover:bg-white/6"
            type="button"
            onClick={endInterview}
            disabled={showMicGate}
          >
            Ավարտել
          </button>
        </div>
      </header>

      {error && !showMicGate ? (
        <p className="relative mt-3 shrink-0 rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <div className="relative mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.6rem] border border-white/10 bg-ink-2/80">
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
        <div
          ref={scrollerRef}
          className={`min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4 sm:px-5 ${
            status !== "text" ? "pt-[268px] sm:pt-[300px]" : "pt-4"
          }`}
        >
          {visibleTurns.map((turn, index) => {
            const isUser = turn.role === "user";
            const isLiveAssistant = !isUser && aiSpeaking && index === visibleTurns.length - 1;
            return (
              <div key={`${turn.role}-${index}`} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}>
                  <span className="px-1 text-[11px] font-medium uppercase tracking-wide text-mist">
                    {isUser ? firstName : "Հարցազրուցավար"}
                  </span>
                  <div
                    className={`rounded-2xl px-3.5 py-2.5 text-[15px] leading-6 ${
                      isUser
                        ? "rounded-br-md bg-brand text-white"
                        : isLiveAssistant
                          ? "rounded-bl-md border border-brand/35 bg-brand/10 text-cloud"
                          : "rounded-bl-md border border-white/10 bg-ink-3 text-cloud"
                    }`}
                  >
                    {turn.content}
                    {isLiveAssistant ? (
                      <span className="mt-2 flex items-center gap-2 text-xs font-medium text-brand">
                        <SpeakingDots />
                        խոսում է
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
          {showAiLiveDots ? (
            <div className="flex justify-start">
              <div className="flex flex-col gap-1">
                <span className="px-1 text-[11px] font-medium uppercase tracking-wide text-mist">Հարցազրուցավար</span>
                <div className="rounded-2xl rounded-bl-md border border-brand/35 bg-brand/10 px-3.5 py-3">
                  <SpeakingDots />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <form
        className="relative mt-3 flex shrink-0 items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void sendText();
        }}
      >
        <input
          className="min-h-11 flex-1 rounded-full border border-white/12 bg-ink-2 px-4 py-2.5 text-[15px] text-cloud outline-none placeholder:text-mist/70 focus:border-brand/50 disabled:opacity-50"
          value={textInput}
          onChange={(event) => setTextInput(event.target.value)}
          placeholder="Գրեք այստեղ, եթե ձայնը հասանելի չէ"
          disabled={showMicGate}
        />
        <button
          className="inline-flex h-11 items-center rounded-full bg-brand px-4 text-sm font-medium text-white hover:bg-[#3b9bff] disabled:opacity-60"
          type="submit"
          disabled={showMicGate}
        >
          Ուղարկել
        </button>
      </form>

      {showMicGate ? (
        <MicPermissionModal
          firstName={firstName}
          connecting={status === "connecting"}
          denied={micDenied}
          unavailable={micUnavailable}
          sessionError={status === "error" ? error : ""}
          onEnable={() => void connectVoice()}
        />
      ) : null}
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
