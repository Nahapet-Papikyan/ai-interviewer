"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { OpenAIRealtimeWebRTC, RealtimeAgent, RealtimeSession, tool } from "@openai/agents/realtime";
import { z } from "zod";
import { BrandLogo } from "@/components/brand/Logo";
import { Alert, AlertDescription, Button, TextInput } from "@/components/shared";
import { MicPermissionModal } from "@/components/interview/MicPermissionModal";
import { VoiceOrb, type VoiceLevels } from "@/components/interview/VoiceOrb";
import {
  CONTINUE_RESPONSE_INSTRUCTIONS,
  NOISE_IGNORE_NOTE,
  openingResponseInstructions,
  TOOL_REJECT_RESULT,
  TOOL_SILENT_RESULT,
  cancelConnectionTeardown,
  closeInterviewConnection,
  conversationItemFromTurn,
  isConnecting,
  isCurrentGeneration,
  markConnecting,
  markOpeningTriggered,
  nextConnectionGeneration,
  registerSessionClose,
  rememberPersistEventId,
  scheduleConnectionTeardown,
  wasOpeningTriggered,
} from "@/lib/interview/client-session";
import {
  configureClientInterviewTrace,
  flushClientTraces,
  interviewLog,
  isBenignRealtimeError,
  isDevInterviewDebug,
  previewText,
  summarizeUnknownError,
} from "@/lib/interview/logging";
import { interviewCopy } from "@/lib/interview/copy";
import { restoreWindow } from "@/lib/interview/messages";
import {
  hydrateRuntimeState,
  shouldConnectRealtime,
  shouldTriggerOpening,
  type InterviewRuntimeState,
} from "@/lib/interview/runtime-state";
import { assessTranscriptQuality, isNoiseTranscript, qualitySystemNote } from "@/lib/interview/transcript-quality";
import { attachProcessedMic } from "@/lib/interview/mic-processing";
import type { InterviewFeatureFlags } from "@/lib/flags";
import {
  BARGE_IN_MIN_MS,
  DEFAULT_REALTIME_VOICE,
  REALTIME_RECONNECT,
  elapsedMsBucket,
  hashDeviceId,
  sdkInputAudioConfig,
  shouldDropAsClick,
  wireInputAudioConfig,
} from "@/lib/openai/realtime-config";

type Turn = {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  providerEventId?: string | null;
};

type Props = {
  token: string;
  interviewId: string;
  firstName: string;
  companyName: string;
  role: string;
  alreadyConsented: boolean;
  existingTurns: Turn[];
  language?: string;
  initialRuntime?: InterviewRuntimeState;
  interviewStatus?: string;
};

function extractTurns(history: unknown[]): Turn[] {
  const turns: Turn[] = [];
  for (const item of history) {
    if (!item || typeof item !== "object") continue;
    const rec = item as {
      type?: string;
      role?: string;
      itemId?: string;
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
    if (content) turns.push({ role, content, providerEventId: rec.itemId ?? null });
  }
  return turns;
}

function mergeTurns(previous: Turn[], incoming: Turn[]): Turn[] {
  const byId = new Map<string, Turn>();
  const result: Turn[] = [];

  function add(turn: Turn) {
    const id = turn.providerEventId?.trim();
    if (id) {
      const existing = byId.get(id);
      if (existing) {
        if (turn.content.length >= existing.content.length) {
          existing.content = turn.content;
          existing.role = turn.role;
        }
        return;
      }
      const next = { ...turn, providerEventId: id };
      byId.set(id, next);
      result.push(next);
      return;
    }
    if (result.some((item) => !item.providerEventId && item.role === turn.role && item.content === turn.content)) {
      return;
    }
    result.push({ ...turn });
  }

  for (const turn of previous) add(turn);
  for (const turn of incoming) add(turn);
  return result;
}

async function sessionAction(
  token: string,
  action: string,
  extra: Record<string, unknown> = {},
  keepalive = false,
) {
  const res = await fetch("/api/interviews/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ interviewToken: token, action, ...extra }),
    keepalive,
  });
  if (keepalive) return null;
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

function nowMs() {
  return Date.now();
}

function statusCopy(
  status: "idle" | "connecting" | "live" | "text" | "ended" | "error",
  language?: string,
) {
  const copy = interviewCopy(language);
  switch (status) {
    case "live":
      return copy.live;
    case "connecting":
      return copy.connecting;
    case "text":
      return copy.text;
    case "error":
      return copy.error;
    default:
      return copy.ready;
  }
}

export function InterviewClient({
  token,
  interviewId,
  firstName,
  companyName,
  role,
  alreadyConsented,
  existingTurns,
  language = "hy",
  initialRuntime,
  interviewStatus = "CONSENTED",
}: Props) {
  const copy = interviewCopy(language);
  const [consented, setConsented] = useState(alreadyConsented);
  const [status, setStatus] = useState<"idle" | "connecting" | "live" | "text" | "ended" | "error">("idle");
  const [error, setError] = useState("");
  const statusRef = useRef(status);
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
  const responseInProgressRef = useRef(false);
  const lastResponseIdRef = useRef<string | null>(null);
  const runtimeRef = useRef<InterviewRuntimeState>(
    hydrateRuntimeState(initialRuntime, existingTurns),
  );
  const interviewIdRef = useRef(interviewId);
  const generationRef = useRef(0);
  const flaggedTranscriptsRef = useRef(new Set<string>());
  const bargeInTimerRef = useRef<number | null>(null);
  const speechStartedAtRef = useRef<number | null>(null);
  const micProcessingStopRef = useRef<(() => void) | null>(null);
  const lastRealtimeErrorRef = useRef<unknown>(null);
  const featuresRef = useRef<InterviewFeatureFlags>({
    micProcessing: false,
    nativeInterrupt: false,
    durationBufferClear: false,
    textAgent: false,
    autoAnalysis: false,
  });
  const audioKeywordsRef = useRef<string[] | undefined>(undefined);
  const [hadLiveSession, setHadLiveSession] = useState(false);

  useEffect(() => {
    interviewIdRef.current = interviewId;
  }, [interviewId]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    configureClientInterviewTrace({ token, interviewId });
    interviewLog("INTERVIEW_PAGE_MOUNTED", {
      interviewId,
      interviewStatus,
      alreadyConsented,
      existingTurns: existingTurns.length,
    });
    return () => {
      interviewLog("INTERVIEW_PAGE_UNMOUNTED", {
        interviewId: interviewIdRef.current,
        connectionGeneration: generationRef.current,
        phase: runtimeRef.current.phase,
        statusHint: endingRef.current ? "ending" : "unmount",
      });
      void flushClientTraces(true);
      configureClientInterviewTrace(null);
    };
    // Mount/unmount tracing only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, interviewId, interviewStatus, alreadyConsented]);

  function alive(generation: number) {
    return isCurrentGeneration(token, generation) && generationRef.current === generation && !endingRef.current;
  }

  function applyMicGate() {
    const off =
      userMutedRef.current ||
      pendingToolsRef.current > 0 ||
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
    mutedRef.current = off;
  }

  function closeSessionSoon() {
    window.setTimeout(() => {
      closeInterviewConnection(token);
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

  function setVadAutoResponse(enabled: boolean, instructions?: string) {
    const audio = wireInputAudioConfig({
      createResponse: enabled,
      language,
      keywords: audioKeywordsRef.current,
      interruptResponse: featuresRef.current.nativeInterrupt,
    });
    try {
      sessionRef.current?.transport.sendEvent({
        type: "session.update",
        session: {
          type: "realtime",
          ...(instructions ? { instructions } : {}),
          audio: {
            input: audio,
          },
        },
      });
    } catch {
      // data channel may not be open yet
    }
  }

  function openListening() {
    if (listeningOpenRef.current) return;
    listeningOpenRef.current = true;
    setListeningOpen(true);
    setVadAutoResponse(true);
    applyMicGate();
    interviewLog("LISTENING_OPEN", {
      interviewId: interviewIdRef.current,
      connectionGeneration: generationRef.current,
    });
  }

  function beginAiSpeech() {
    if (aiHoldTimerRef.current) {
      window.clearTimeout(aiHoldTimerRef.current);
      aiHoldTimerRef.current = null;
    }
    responseInProgressRef.current = true;
    if (aiSpeakingRef.current) return;
    aiSpeakingRef.current = true;
    setAiSpeaking(true);
  }

  function noteFollowUpAudioStarted() {
    beginAiSpeech();
  }

  async function runToolSilently<T>(work: () => Promise<T>, fallback: T): Promise<T> {
    pendingToolsRef.current += 1;
    applyMicGate();
    interviewLog("TOOL_CALL_STARTED", {
      interviewId: interviewIdRef.current,
      connectionGeneration: generationRef.current,
    });
    try {
      return await work();
    } catch {
      return fallback;
    } finally {
      pendingToolsRef.current = Math.max(0, pendingToolsRef.current - 1);
      applyMicGate();
      interviewLog("TOOL_CALL_COMPLETED", {
        interviewId: interviewIdRef.current,
        connectionGeneration: generationRef.current,
      });
    }
  }

  function endAiSpeech() {
    if (!aiSpeakingRef.current || aiHoldTimerRef.current) return;
    if (pendingToolsRef.current > 0) return;
    aiHoldTimerRef.current = window.setTimeout(() => {
      aiHoldTimerRef.current = null;
      if (pendingToolsRef.current > 0) return;
      aiSpeakingRef.current = false;
      responseInProgressRef.current = false;
      setAiSpeaking(false);
      if (introPendingRef.current) {
        introPendingRef.current = false;
        openListening();
        return;
      }
      applyMicGate();
    }, 400);
  }

  function restoreLiveVoice(reason: string) {
    if (endingRef.current || !sessionRef.current) return;
    if (statusRef.current !== "text" && statusRef.current !== "error") return;
    interviewLog("VOICE_UI_RESTORED", {
      interviewId: interviewIdRef.current,
      connectionGeneration: generationRef.current,
      reason,
      previous: statusRef.current,
    });
    statusRef.current = "live";
    setStatus("live");
    setError("");
  }

  function cancelAssistantIfSpeaking(reason = "manual") {
    const hadResponse = aiSpeakingRef.current || responseInProgressRef.current;
    if (!hadResponse) {
      interviewLog("ASSISTANT_CANCEL_SKIPPED", {
        interviewId: interviewIdRef.current,
        connectionGeneration: generationRef.current,
        reason,
      });
      return;
    }
    try {
      sessionRef.current?.interrupt();
    } catch {
      // transport may not support interrupt yet
    }
    aiSpeakingRef.current = false;
    responseInProgressRef.current = false;
    setAiSpeaking(false);
    if (aiHoldTimerRef.current) {
      window.clearTimeout(aiHoldTimerRef.current);
      aiHoldTimerRef.current = null;
    }
    interviewLog("ASSISTANT_RESPONSE_CANCELLED", {
      interviewId: interviewIdRef.current,
      connectionGeneration: generationRef.current,
      responseId: lastResponseIdRef.current,
      reason,
    });
  }

  function handleUserSpeechStarted() {
    if (!listeningOpenRef.current || endingRef.current) {
      interviewLog("SPEECH_STARTED_IGNORED", {
        interviewId: interviewIdRef.current,
        connectionGeneration: generationRef.current,
        listeningOpen: listeningOpenRef.current,
        ending: endingRef.current,
      });
      clearInputAudio();
      return;
    }
    speechStartedAtRef.current = nowMs();
    levelsRef.current.user = Math.max(levelsRef.current.user, 0.26);
    restoreLiveVoice("user_speech");
    interviewLog("SPEECH_STARTED", {
      interviewId: interviewIdRef.current,
      connectionGeneration: generationRef.current,
      aiSpeaking: aiSpeakingRef.current,
      responseInProgress: responseInProgressRef.current,
    });
    if (featuresRef.current.nativeInterrupt) return;
    if (!(aiSpeakingRef.current || responseInProgressRef.current)) return;
    if (bargeInTimerRef.current) window.clearTimeout(bargeInTimerRef.current);
    interviewLog("BARGE_IN_ARMED", {
      interviewId: interviewIdRef.current,
      connectionGeneration: generationRef.current,
      waitMs: BARGE_IN_MIN_MS,
    });
    bargeInTimerRef.current = window.setTimeout(() => {
      bargeInTimerRef.current = null;
      if (!listeningOpenRef.current || endingRef.current) return;
      if (!aiSpeakingRef.current && !responseInProgressRef.current) return;
      interviewLog("BARGE_IN_FIRED", {
        interviewId: interviewIdRef.current,
        connectionGeneration: generationRef.current,
      });
      cancelAssistantIfSpeaking("barge_in");
    }, BARGE_IN_MIN_MS);
  }

  function handleUserSpeechStopped() {
    const started = speechStartedAtRef.current;
    speechStartedAtRef.current = null;
    const elapsed = started ? nowMs() - started : 0;
    const armed = bargeInTimerRef.current != null;
    if (bargeInTimerRef.current) {
      window.clearTimeout(bargeInTimerRef.current);
      bargeInTimerRef.current = null;
    }
    levelsRef.current.user *= 0.12;
    const dropped = shouldDropAsClick(elapsed);
    interviewLog("SPEECH_STOPPED", {
      interviewId: interviewIdRef.current,
      connectionGeneration: generationRef.current,
      elapsedMs: elapsed,
      elapsedMsBucket: elapsedMsBucket(elapsed),
      droppedAsClick: dropped,
      abortedBargeIn: armed && dropped,
    });
    if (dropped && featuresRef.current.durationBufferClear) {
      clearInputAudio();
    }
  }

  function toggleUserMic() {
    if (pendingToolsRef.current > 0 || endingRef.current || !listeningOpenRef.current) return;
    userMutedRef.current = !userMutedRef.current;
    setUserMuted(userMutedRef.current);
    applyMicGate();
  }

  function persistRuntime(patch: Partial<InterviewRuntimeState>) {
    runtimeRef.current = { ...runtimeRef.current, ...patch };
    void sessionAction(token, "runtime", patch);
  }

  /* eslint-disable react-hooks/refs, react-hooks/exhaustive-deps -- tool execute closures run later via the Realtime SDK */
  const tools = useMemo(
    () => [
      tool({
        name: "record_process_candidate",
        description:
          "Silently mark a promising recurring process. Never speak before or after this tool. After the result, ask exactly one next question.",
        parameters: z.object({
          name: z.string(),
          short_reason: z.string(),
        }),
        async execute({ name, short_reason }) {
          return runToolSilently(async () => {
            await sessionAction(token, "process", { name, shortReason: short_reason });
            return TOOL_SILENT_RESULT;
          }, TOOL_SILENT_RESULT);
        },
      }),
      tool({
        name: "record_key_fact",
        description:
          "Silently store a critical fact only after the respondent clearly stated it or confirmed it. Never record garbled speech. Never speak about this tool.",
        parameters: z.object({
          category: z.enum(["volume", "time", "people", "system", "error", "impact", "pilot"]),
          value: z.string(),
          process_name: z.string(),
          evidence_summary: z.string(),
          status: z.enum(["CONFIRMED", "UNCERTAIN"]),
          raw_transcript: z.string(),
        }),
        async execute({ category, value, process_name, evidence_summary, status, raw_transcript }) {
          return runToolSilently(async () => {
            const result = await sessionAction(token, "fact", {
              category,
              value,
              processName: process_name,
              evidenceSummary: evidence_summary,
              status: status ?? "CONFIRMED",
              rawTranscript: raw_transcript || undefined,
              sourceRole: "user",
            });
            if (result?.recorded === false) return TOOL_REJECT_RESULT;
            return TOOL_SILENT_RESULT;
          }, TOOL_SILENT_RESULT);
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
          persistRuntime({ completed: true, phase: "COMPLETED" });
          setStatus("ended");
          closeSessionSoon();
          return "Interview marked complete.";
        },
      }),
    ],
    [token],
  );
  /* eslint-enable react-hooks/refs, react-hooks/exhaustive-deps */

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

    const lastTurn = incoming.at(-1);
    const lastUser = [...incoming].reverse().find((turn) => turn.role === "user");
    if (lastUser) {
      const noise = isNoiseTranscript(lastUser.content);
      const quality = assessTranscriptQuality(lastUser.content);
      const key = lastUser.providerEventId || lastUser.content;
      const latestIsThisUser = lastTurn?.role === "user" && lastTurn.content === lastUser.content;
      if (noise) {
        if (!flaggedTranscriptsRef.current.has(`noise:${key}`)) {
          flaggedTranscriptsRef.current.add(`noise:${key}`);
          interviewLog("NOISE_TRANSCRIPT_IGNORED", {
            interviewId: interviewIdRef.current,
            reasons: ["noise_or_filler"],
            connectionGeneration: generationRef.current,
            chars: lastUser.content.length,
            preview: previewText(lastUser.content),
            cancelledResponse: latestIsThisUser,
          });
          try {
            if (latestIsThisUser) cancelAssistantIfSpeaking("noise_transcript");
            sessionRef.current?.transport.sendEvent({
              type: "conversation.item.create",
              item: {
                type: "message",
                role: "system",
                content: [{ type: "input_text", text: NOISE_IGNORE_NOTE }],
              },
            });
          } catch {
            // ignore
          }
        }
      } else if (quality.needsClarification && !flaggedTranscriptsRef.current.has(key)) {
        flaggedTranscriptsRef.current.add(key);
        interviewLog("UNCERTAIN_TRANSCRIPT_DETECTED", {
          interviewId: interviewIdRef.current,
          reasons: quality.reasons,
          connectionGeneration: generationRef.current,
          chars: lastUser.content.length,
          preview: previewText(lastUser.content),
        });
        try {
          sessionRef.current?.transport.sendEvent({
            type: "conversation.item.create",
            item: {
              type: "message",
              role: "system",
              content: [{ type: "input_text", text: qualitySystemNote(lastUser.content, quality) }],
            },
          });
        } catch {
          // ignore
        }
      }
      if (!noise && runtimeRef.current.openingDelivered && !runtimeRef.current.consentReceived) {
        persistRuntime({
          consentReceived: true,
          interviewStarted: true,
          phase: runtimeRef.current.activeProcess ? "DEEP_DIVE" : "DISCOVERY",
        });
      }
    }

    if (next.length === 0 || incoming.length === 0) return;
    let grew = false;
    for (const turn of incoming) {
      if (!turn.providerEventId) {
        if (!unchanged) grew = true;
        continue;
      }
      if (rememberPersistEventId(token, turn.providerEventId, turn.content.length)) grew = true;
    }
    if (!grew) return;
    if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);
    persistTimerRef.current = window.setTimeout(() => {
      persistTimerRef.current = null;
      void sessionAction(token, "history", { turns: latestTurnsRef.current }).catch((err) => {
        interviewLog("HISTORY_PERSIST_FAILED", {
          interviewId: interviewIdRef.current,
          error: summarizeUnknownError(err),
        });
      });
    }, 450);
  }

  async function connectVoice() {
    if (endingRef.current) return;
    if (!shouldConnectRealtime(interviewStatus) || runtimeRef.current.completed) {
      interviewLog("CONNECT_SKIPPED_FINISHED", {
        interviewId: interviewIdRef.current,
        interviewStatus,
        completed: runtimeRef.current.completed,
      });
      setStatus("ended");
      return;
    }
    if (connectingRef.current || isConnecting(token)) {
      interviewLog("CONNECT_SKIPPED_IN_FLIGHT", {
        interviewId: interviewIdRef.current,
        connectingRef: connectingRef.current,
      });
      return;
    }
    connectingRef.current = true;
    markConnecting(token, true);
    const generation = nextConnectionGeneration(token);
    generationRef.current = generation;
    setStatus("connecting");
    setError("");
    setMicDenied(false);
    setMicUnavailable(false);
    setUserMuted(false);
    setListeningOpen(false);
    userMutedRef.current = false;
    listeningOpenRef.current = false;
    responseInProgressRef.current = false;
    interviewLog("CONNECT_START", {
      interviewId: interviewIdRef.current,
      connectionGeneration: generation,
      reconnectAttempt: reconnects.current,
      phase: runtimeRef.current.phase,
    });
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        interviewLog("MIC_UNAVAILABLE", {
          interviewId: interviewIdRef.current,
          connectionGeneration: generation,
          reason: "no_media_devices",
        });
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
      if (!alive(generation)) {
        mediaStream.getTracks().forEach((track) => track.stop());
        return;
      }
      mediaStream.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
      mediaStreamRef.current = mediaStream;
      listeningOpenRef.current = false;
      mutedRef.current = true;

      const audioCtx = new AudioContext();
      await audioCtx.resume();

      const res = await tokenPromise;
      if (!alive(generation)) {
        mediaStream.getTracks().forEach((track) => track.stop());
        void audioCtx.close();
        return;
      }
      if (res.status === 409) {
        interviewLog("TOKEN_REJECTED_FINISHED", {
          interviewId: interviewIdRef.current,
          connectionGeneration: generation,
        });
        mediaStream.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        void audioCtx.close();
        endingRef.current = true;
        setStatus("ended");
        return;
      }
      if (!res.ok) {
        interviewLog("TOKEN_FAILED", {
          interviewId: interviewIdRef.current,
          connectionGeneration: generation,
          status: res.status,
        });
        mediaStream.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        void audioCtx.close();
        throw new Error(copy.tokenFailed);
      }
      const data = (await res.json()) as {
        clientSecret: string;
        model: string;
        voice?: string;
        instructions?: string;
        interviewId?: string;
        continuation?: boolean;
        runtimeState?: InterviewRuntimeState;
        recentTurns?: Turn[];
        promptVersion?: string;
        promptSource?: string;
        promptHash?: string;
        features?: InterviewFeatureFlags;
        audioInput?: ReturnType<typeof sdkInputAudioConfig>;
      };
      if (data.interviewId) interviewIdRef.current = data.interviewId;
      if (data.features) featuresRef.current = data.features;
      audioKeywordsRef.current = data.audioInput?.transcription.keywords;
      if (data.runtimeState) {
        runtimeRef.current = hydrateRuntimeState(data.runtimeState, data.recentTurns ?? latestTurnsRef.current);
      }
      const restoredTurns = restoreWindow(data.recentTurns?.length ? data.recentTurns : latestTurnsRef.current);
      const voice = data.voice || DEFAULT_REALTIME_VOICE;
      const audioInput =
        data.audioInput ??
        sdkInputAudioConfig({
          createResponse: false,
          language,
          interruptResponse: featuresRef.current.nativeInterrupt,
        });
      const triggerOpening = shouldTriggerOpening({
        openingDelivered: runtimeRef.current.openingDelivered || wasOpeningTriggered(token),
        completed: runtimeRef.current.completed,
        isReconnect: Boolean(data.continuation) || reconnects.current > 0,
        assistantTurnCount: restoredTurns.filter((turnItem) => turnItem.role === "assistant").length,
      });
      introPendingRef.current = triggerOpening;

      if (isDevInterviewDebug()) {
        console.debug({
          event: "INTERVIEW_SESSION_CREATED",
          interviewId: interviewIdRef.current,
          promptVersion: data.promptVersion,
          promptSource: data.promptSource,
          promptHash: data.promptHash,
          phase: runtimeRef.current.phase,
          openingDelivered: runtimeRef.current.openingDelivered,
          consentReceived: runtimeRef.current.consentReceived,
          continuation: data.continuation,
          connectionGeneration: generation,
          language,
        });
      }
      interviewLog(data.continuation ? "REALTIME_RECONNECTED" : "REALTIME_CONNECTED", {
        interviewId: interviewIdRef.current,
        promptVersion: data.promptVersion,
        promptHash: data.promptHash,
        connectionGeneration: generation,
        continuation: Boolean(data.continuation),
        triggerOpening,
        restoredTurns: restoredTurns.length,
        phase: runtimeRef.current.phase,
        openingDelivered: runtimeRef.current.openingDelivered,
      });

      const micAnalyser = audioCtx.createAnalyser();
      micAnalyser.fftSize = 2048;
      micAnalyser.smoothingTimeConstant = 0.7;
      audioCtx.createMediaStreamSource(mediaStream).connect(micAnalyser);

      const outAnalyser = audioCtx.createAnalyser();
      outAnalyser.fftSize = 2048;
      outAnalyser.smoothingTimeConstant = 0.65;
      const micBuffer = new Uint8Array(micAnalyser.fftSize) as Uint8Array<ArrayBuffer>;
      const outBuffer = new Uint8Array(outAnalyser.fftSize) as Uint8Array<ArrayBuffer>;

      let sendStream = mediaStream;
      let usedProcessedMic = false;
      if (featuresRef.current.micProcessing) {
        try {
          const processed = attachProcessedMic(audioCtx, mediaStream);
          micProcessingStopRef.current?.();
          micProcessingStopRef.current = processed.stop;
          sendStream = processed.stream;
          usedProcessedMic = true;
        } catch (err) {
          micProcessingStopRef.current = null;
          interviewLog("MIC_PROCESSING_FALLBACK", {
            interviewId: interviewIdRef.current,
            connectionGeneration: generation,
            error: summarizeUnknownError(err),
          });
        }
      }
      const trackSettings = mediaStream.getAudioTracks()[0]?.getSettings() ?? {};
      const deviceIdHash =
        typeof trackSettings.deviceId === "string" ? hashDeviceId(trackSettings.deviceId) : null;
      interviewLog("MIC_STREAM_READY", {
        interviewId: interviewIdRef.current,
        connectionGeneration: generation,
        processed: usedProcessedMic,
        sendTracks: sendStream.getAudioTracks().length,
        echoCancellation: trackSettings.echoCancellation ?? null,
        noiseSuppression: trackSettings.noiseSuppression ?? null,
        autoGainControl: trackSettings.autoGainControl ?? null,
        sampleRate: trackSettings.sampleRate ?? null,
        channelCount: trackSettings.channelCount ?? null,
        deviceIdHash,
      });
      void sessionAction(token, "telemetry", {
        settings: {
          echoCancellation: trackSettings.echoCancellation ?? null,
          noiseSuppression: trackSettings.noiseSuppression ?? null,
          autoGainControl: trackSettings.autoGainControl ?? null,
          sampleRate: trackSettings.sampleRate ?? null,
          channelCount: trackSettings.channelCount ?? null,
          deviceIdHash,
          processedMic: usedProcessedMic,
        },
      }).catch(() => undefined);

      let remoteTapped = false;
      const transport = new OpenAIRealtimeWebRTC({
        mediaStream: sendStream,
        changePeerConnection: (peerConnection) => {
          const logState = (kind: string) => {
            interviewLog(kind, {
              interviewId: interviewIdRef.current,
              connectionGeneration: generation,
              connectionState: peerConnection.connectionState,
              iceConnectionState: peerConnection.iceConnectionState,
              iceGatheringState: peerConnection.iceGatheringState,
              signalingState: peerConnection.signalingState,
            });
          };
          peerConnection.addEventListener("connectionstatechange", () => logState("WEBRTC_CONNECTION_STATE"));
          peerConnection.addEventListener("iceconnectionstatechange", () => logState("WEBRTC_ICE_STATE"));
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
            input: audioInput,
            output: {
              voice,
            },
          },
        },
      });
      session.on("history_updated", (history) => {
        if (!alive(generation)) return;
        persistHistory(history as unknown[]).catch((err) => {
          interviewLog("HISTORY_PERSIST_FAILED", {
            interviewId: interviewIdRef.current,
            connectionGeneration: generation,
            error: summarizeUnknownError(err),
          });
        });
      });
      session.on("error", (error) => {
        if (!alive(generation)) {
          interviewLog("SESSION_ERROR_STALE", {
            interviewId: interviewIdRef.current,
            connectionGeneration: generation,
            currentGeneration: generationRef.current,
            error: summarizeUnknownError(error),
          });
          return;
        }
        if (isBenignRealtimeError(error) || isBenignRealtimeError(lastRealtimeErrorRef.current)) {
          interviewLog("SESSION_ERROR_IGNORED", {
            interviewId: interviewIdRef.current,
            connectionGeneration: generation,
            error: summarizeUnknownError(error),
            lastTransportError: summarizeUnknownError(lastRealtimeErrorRef.current),
          });
          lastRealtimeErrorRef.current = null;
          restoreLiveVoice("benign_session_error");
          return;
        }
        if (pendingToolsRef.current > 0) {
          interviewLog("SESSION_ERROR_DURING_TOOL", {
            interviewId: interviewIdRef.current,
            connectionGeneration: generation,
            error: summarizeUnknownError(error),
          });
          return;
        }
        interviewLog("REALTIME_DISCONNECTED", {
          interviewId: interviewIdRef.current,
          connectionGeneration: generation,
          error: summarizeUnknownError(error),
        });
        void attemptReconnect();
      });
      session.on("audio_start", () => {
        if (!alive(generation)) return;
        if (introFallbackRef.current) {
          window.clearTimeout(introFallbackRef.current);
          introFallbackRef.current = null;
        }
        levelsRef.current.ai = Math.max(levelsRef.current.ai, 0.32);
        noteFollowUpAudioStarted();
        restoreLiveVoice("assistant_audio");
        interviewLog("ASSISTANT_RESPONSE_STARTED", {
          interviewId: interviewIdRef.current,
          connectionGeneration: generation,
          responseId: lastResponseIdRef.current,
        });
      });
      session.on("audio_stopped", () => {
        if (!alive(generation)) return;
        levelsRef.current.ai *= 0.15;
        endAiSpeech();
        interviewLog("ASSISTANT_RESPONSE_COMPLETED", {
          interviewId: interviewIdRef.current,
          connectionGeneration: generation,
          responseId: lastResponseIdRef.current,
        });
      });
      session.on("audio_interrupted", () => {
        if (!alive(generation)) return;
        levelsRef.current.ai = 0;
        aiSpeakingRef.current = false;
        responseInProgressRef.current = false;
        setAiSpeaking(false);
        interviewLog("ASSISTANT_RESPONSE_CANCELLED", {
          interviewId: interviewIdRef.current,
          connectionGeneration: generation,
          responseId: lastResponseIdRef.current,
        });
      });
      session.on("transport_event", (event) => {
        if (!alive(generation)) return;
        const eventType = typeof event.type === "string" ? event.type : "";
        if (eventType === "error") {
          lastRealtimeErrorRef.current = event;
          if (isBenignRealtimeError(event)) {
            interviewLog("TRANSPORT_ERROR_IGNORED", {
              interviewId: interviewIdRef.current,
              connectionGeneration: generation,
              error: summarizeUnknownError(event),
            });
            restoreLiveVoice("benign_transport_error");
            return;
          }
        }
        if (
          eventType === "error" ||
          eventType === "session.created" ||
          eventType === "session.updated" ||
          eventType.endsWith(".failed") ||
          eventType.includes("transcription.failed")
        ) {
          interviewLog("TRANSPORT_EVENT", {
            interviewId: interviewIdRef.current,
            connectionGeneration: generation,
            type: eventType,
            error: eventType === "error" ? summarizeUnknownError(event) : undefined,
          });
        }
        if (event.type === "response.created") {
          const responseId = (event as { response?: { id?: string }; response_id?: string }).response?.id
            ?? (event as { response_id?: string }).response_id
            ?? null;
          if (responseId && lastResponseIdRef.current === responseId) return;
          lastResponseIdRef.current = responseId;
          beginAiSpeech();
        }
        if (event.type === "output_audio_buffer.started") {
          noteFollowUpAudioStarted();
        }
        if (event.type === "response.done" || event.type === "response.cancelled") {
          responseInProgressRef.current = false;
        }
        if (event.type === "input_audio_buffer.speech_started") {
          handleUserSpeechStarted();
          return;
        }
        if (event.type === "input_audio_buffer.speech_stopped") {
          handleUserSpeechStopped();
          if (!listeningOpenRef.current || pendingToolsRef.current > 0 || endingRef.current) {
            clearInputAudio();
            return;
          }
          interviewLog("USER_TURN_FINALIZED", {
            interviewId: interviewIdRef.current,
            connectionGeneration: generation,
          });
          return;
        }
        if (!listeningOpenRef.current || pendingToolsRef.current > 0 || endingRef.current) {
          if (event.type === "input_audio_buffer.committed") {
            clearInputAudio();
          }
          return;
        }
      });
      await session.connect({ apiKey: data.clientSecret });
      reconnects.current = 0;
      interviewLog("SESSION_CONNECT_OK", {
        interviewId: interviewIdRef.current,
        connectionGeneration: generation,
        processedMic: usedProcessedMic,
      });
      if (!alive(generation)) {
        session.close();
        micProcessingStopRef.current?.();
        micProcessingStopRef.current = null;
        mediaStream.getTracks().forEach((track) => track.stop());
        void audioCtx.close();
        return;
      }
      sessionRef.current = session;
      registerSessionClose(token, () => {
        try {
          session.close();
        } catch {
          // already closed
        }
      });
      session.mute(true);
      mediaStream.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });

      for (const restored of restoredTurns) {
        if (restored.role !== "user" && restored.role !== "assistant") continue;
        try {
          session.transport.sendEvent({
            type: "conversation.item.create",
            item: conversationItemFromTurn({ role: restored.role, content: restored.content }),
          });
        } catch {
          // restore is best-effort
        }
      }

      if (data.instructions && (data.continuation || !triggerOpening)) {
        setVadAutoResponse(false, data.instructions);
      }

      if (!triggerOpening) {
        try {
          session.transport.sendEvent({
            type: "conversation.item.create",
            item: {
              type: "message",
              role: "system",
              content: [{ type: "input_text", text: CONTINUE_RESPONSE_INSTRUCTIONS }],
            },
          });
        } catch {
          // ignore
        }
      }

      if (triggerOpening) {
        markOpeningTriggered(token);
        persistRuntime({ openingDelivered: true, phase: "AWAITING_CONSENT", interviewStarted: true });
        beginAiSpeech();
        session.transport.sendEvent({
          type: "response.create",
          response: { instructions: openingResponseInstructions({ language, firstName }) },
        });
        interviewLog("OPENING_TRIGGERED", {
          interviewId: interviewIdRef.current,
          connectionGeneration: generation,
        });
        introFallbackRef.current = window.setTimeout(() => {
          if (!alive(generation) || !introPendingRef.current) return;
          interviewLog("OPENING_FALLBACK_LISTENING", {
            interviewId: interviewIdRef.current,
            connectionGeneration: generation,
          });
          introPendingRef.current = false;
          aiSpeakingRef.current = false;
          setAiSpeaking(false);
          openListening();
        }, 8000);
      } else {
        introPendingRef.current = false;
        openListening();
      }

      let raf = 0;
      const pump = () => {
        if (!alive(generation)) return;
        const aiLevel = Math.min(1, readRms(outAnalyser, outBuffer) * 5.8);
        if (aiLevel > 0.06) beginAiSpeech();
        else if (aiLevel < 0.02 && !introPendingRef.current && pendingToolsRef.current === 0) {
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
        if (bargeInTimerRef.current) window.clearTimeout(bargeInTimerRef.current);
        bargeInTimerRef.current = null;
        speechStartedAtRef.current = null;
        micProcessingStopRef.current?.();
        micProcessingStopRef.current = null;
        pendingToolsRef.current = 0;
        listeningOpenRef.current = false;
        introPendingRef.current = false;
        setListeningOpen(false);
        mediaStream.getTracks().forEach((track) => track.stop());
        sendStream.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        void audioCtx.close();
      };

      setHadLiveSession(true);
      setStatus("live");
    } catch (err) {
      if (!alive(generation) && endingRef.current) return;
      micProcessingStopRef.current?.();
      micProcessingStopRef.current = null;
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") {
        interviewLog("MIC_DENIED", {
          interviewId: interviewIdRef.current,
          connectionGeneration: generation,
          name,
        });
        setMicDenied(true);
        setStatus("idle");
        setError("");
        return;
      }
      if (name === "NotFoundError" || name === "NotReadableError" || name === "OverconstrainedError") {
        interviewLog("MIC_UNAVAILABLE", {
          interviewId: interviewIdRef.current,
          connectionGeneration: generation,
          name,
        });
        setMicUnavailable(true);
        setStatus("idle");
        setError("");
        return;
      }
      interviewLog("CONNECT_FAILED", {
        interviewId: interviewIdRef.current,
        connectionGeneration: generation,
        error: summarizeUnknownError(err),
      });
      setError(err instanceof Error ? err.message : copy.connectFailed);
      setStatus("error");
    } finally {
      connectingRef.current = false;
      markConnecting(token, false);
    }
  }

  async function attemptReconnect() {
    if (endingRef.current || runtimeRef.current.completed) {
      interviewLog("RECONNECT_SKIPPED", {
        interviewId: interviewIdRef.current,
        ending: endingRef.current,
        completed: runtimeRef.current.completed,
      });
      return;
    }
    if (reconnects.current >= REALTIME_RECONNECT.maxAttempts) {
      if (sessionRef.current) {
        interviewLog("RECONNECT_EXHAUSTED_SESSION_ALIVE", {
          interviewId: interviewIdRef.current,
          attempts: reconnects.current,
          connectionGeneration: generationRef.current,
        });
        restoreLiveVoice("reconnect_exhausted_but_alive");
        return;
      }
      interviewLog("RECONNECT_EXHAUSTED", {
        interviewId: interviewIdRef.current,
        attempts: reconnects.current,
        maxAttempts: REALTIME_RECONNECT.maxAttempts,
        connectionGeneration: generationRef.current,
      });
      setStatus("text");
      setError(copy.reconnectText);
      return;
    }
    const attempt = reconnects.current;
    reconnects.current += 1;
    const delay = Math.min(
      REALTIME_RECONNECT.baseDelayMs * 2 ** attempt,
      REALTIME_RECONNECT.maxDelayMs,
    );
    interviewLog("RECONNECT_SCHEDULED", {
      interviewId: interviewIdRef.current,
      attempt: reconnects.current,
      delayMs: delay,
      connectionGeneration: generationRef.current,
    });
    sessionRef.current?.close();
    sessionRef.current = null;
    audioCleanupRef.current?.();
    audioCleanupRef.current = null;
    await new Promise((resolve) => window.setTimeout(resolve, delay));
    if (endingRef.current) return;
    await connectVoice();
  }

  async function acceptConsent() {
    await sessionAction(token, "consent");
    persistRuntime({ consentReceived: true, phase: "AWAITING_CONSENT" });
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
    persistRuntime({ completed: true, phase: "COMPLETED" });
    closeInterviewConnection(token);
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
    cancelConnectionTeardown(token);
    function flushHidden() {
      if (persistTimerRef.current) {
        window.clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
      const turnsToFlush = latestTurnsRef.current;
      if (!turnsToFlush.length || endingRef.current) return;
      void sessionAction(token, "history", { turns: turnsToFlush }, true);
      flushClientTraces();
    }
    function onVisibility() {
      if (document.visibilityState === "hidden") flushHidden();
    }
    window.addEventListener("pagehide", flushHidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flushHidden);
      document.removeEventListener("visibilitychange", onVisibility);
      if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);
      scheduleConnectionTeardown(token);
    };
  }, [token]);

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
          <p className="text-[11px] font-semibold tracking-[0.18em] text-brand uppercase">
            {companyName || copy.consentEyebrowFallback}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-cloud">{copy.consentTitle(firstName)}</h1>
          <div className="mt-6 space-y-3 text-[15px] leading-7 text-mist">
            <p>{copy.consentIntro(companyName)}</p>
            <p>{copy.consentDuration(role)}</p>
            <ul className="space-y-2 rounded-2xl border border-white/10 bg-ink-2 p-4 text-sm text-cloud/90">
              <li>{copy.consentStore}</li>
              <li>{copy.consentNoAudio}</li>
              <li>{copy.consentSecrets}</li>
            </ul>
          </div>
          <Button className="mt-8 h-11 px-5" type="button" onClick={acceptConsent}>
            {copy.consentButton}
          </Button>
        </div>
      </div>
    );
  }

  if (status === "ended") {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
        <BrandLogo size={72} className="mb-6" />
        <h1 className="text-3xl font-semibold tracking-tight text-cloud">{copy.thanksTitle(firstName)}</h1>
        <p className="mt-3 text-[15px] leading-7 text-mist">{copy.thanksBody}</p>
      </div>
    );
  }

  const meta = statusCopy(status, language);
  const visibleTurns = turns.filter((turn) => turn.role === "user" || turn.role === "assistant");
  const lastTurn = visibleTurns[visibleTurns.length - 1];
  const showAiLiveDots = status === "live" && aiSpeaking && lastTurn?.role !== "assistant";
  const voiceMode = status === "connecting" ? "connecting" : status === "live" ? "live" : "idle";
  const showMicGate =
    status === "idle" ||
    status === "error" ||
    (status === "connecting" && !hadLiveSession);

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
              <span>{copy.languageName}</span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            className="h-9 border-white/12 bg-white/[0.03] px-3.5 text-cloud hover:bg-white/6 hover:text-cloud"
            type="button"
            onClick={endInterview}
            disabled={showMicGate}
          >
            {copy.end}
          </Button>
        </div>
      </header>

      {error && !showMicGate ? (
        <Alert variant="destructive" className="relative mt-3 shrink-0 border-red-400/25 bg-red-500/10 text-red-200">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="relative mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.6rem] border border-white/10 bg-ink-2/80">
        {status !== "text" ? (
          <VoiceOrb
            mode={voiceMode}
            userMuted={userMuted}
            aiSpeaking={aiSpeaking}
            listeningOpen={listeningOpen}
            language={language}
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
                    {isUser ? firstName : copy.interviewer}
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
                        {copy.speaking}
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
                <span className="px-1 text-[11px] font-medium uppercase tracking-wide text-mist">{copy.interviewer}</span>
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
        <TextInput
          className="min-h-11 h-11 flex-1 rounded-full border-white/12 bg-ink-2 px-4 py-2.5 text-[15px] text-cloud placeholder:text-mist/70 focus-visible:border-brand/50"
          value={textInput}
          onChange={(event) => setTextInput(event.target.value)}
          placeholder={copy.placeholder}
          disabled={showMicGate}
        />
        <Button className="h-11" type="submit" disabled={showMicGate}>
          {copy.send}
        </Button>
      </form>

      {showMicGate ? (
        <MicPermissionModal
          firstName={firstName}
          language={language}
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
