export const DEFAULT_REALTIME_MODEL = "gpt-realtime-2.1";
export const DEFAULT_REALTIME_VOICE = "sage";
export const REALTIME_TRANSCRIBE_LANGUAGE = "hy";
export const REALTIME_TRANSCRIBE_PROMPT =
  "Eastern Armenian (արևելահայերեն) as spoken in Yerevan and the Republic of Armenia. Transcribe in Armenian script. Do not transcribe as Western Armenian or Iranian Armenian.";

/**
 * Conversational turn-taking for Eastern Armenian interviews.
 * Prefer patience over aggressive cut-offs: respondents often pause mid-sentence.
 * API interrupt_response stays false; the client barges in only after sustained speech.
 */
export const VOICE_TURN_CONFIG = {
  type: "semantic_vad" as const,
  eagerness: "low" as const,
  createResponse: false,
  interruptResponse: false,
  prefixPaddingMs: 400,
  silenceDurationMs: 900,
  threshold: 0.45,
};

export const REALTIME_NOISE_REDUCTION = {
  type: "near_field" as const,
};

export const BARGE_IN_MIN_MS = 350;

export const MIC_PROCESSING = {
  highpassHz: 85,
  gateOpenRms: 0.02,
  gateCloseRms: 0.01,
  hangoverMs: 280,
};

export const REALTIME_RECONNECT = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 8000,
};

export function realtimeModel() {
  return process.env.OPENAI_REALTIME_MODEL?.trim() || DEFAULT_REALTIME_MODEL;
}

export function realtimeVoice() {
  return process.env.OPENAI_REALTIME_VOICE?.trim() || DEFAULT_REALTIME_VOICE;
}

export function voiceTurnDetection(createResponse: boolean) {
  return {
    type: VOICE_TURN_CONFIG.type,
    eagerness: VOICE_TURN_CONFIG.eagerness,
    createResponse,
    interruptResponse: VOICE_TURN_CONFIG.interruptResponse,
    prefixPaddingMs: VOICE_TURN_CONFIG.prefixPaddingMs,
    silenceDurationMs: VOICE_TURN_CONFIG.silenceDurationMs,
    threshold: VOICE_TURN_CONFIG.threshold,
  };
}
