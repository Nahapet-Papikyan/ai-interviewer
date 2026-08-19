export const DEFAULT_REALTIME_MODEL = "gpt-realtime-2.1";
export const DEFAULT_REALTIME_VOICE = "sage";
export const REALTIME_TRANSCRIBE_MODEL = "gpt-live-transcribe";
export const REALTIME_TRANSCRIBE_DELAY = "medium";

export const DEFAULT_TRANSCRIPTION_KEYWORDS = [
  "1C",
  "ArmSoft",
  "Excel",
  "ERP",
  "CRM",
  "SKU",
  "API",
  "WhatsApp",
  "Telegram",
];

/**
 * Conversational turn-taking for Eastern Armenian interviews.
 * Prefer patience over aggressive cut-offs: respondents often pause mid-sentence.
 * Native interrupt_response is off unless FEATURE_NATIVE_INTERRUPT is enabled.
 * prefix/silence/threshold are server_vad-only and must not be sent with semantic_vad.
 */
export const VOICE_TURN_CONFIG = {
  type: "semantic_vad" as const,
  eagerness: "low" as const,
  createResponse: false,
  interruptResponse: false,
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

export function interviewLanguageCode(language?: string | null) {
  const value = (language || "hy").toLowerCase();
  if (value.startsWith("ru")) return "ru";
  if (value.startsWith("en")) return "en";
  return "hy";
}

export function transcriptionLanguages(language?: string | null) {
  const code = interviewLanguageCode(language);
  if (code === "ru") return ["ru", "hy", "en"];
  if (code === "en") return ["en", "hy", "ru"];
  return ["hy", "ru", "en"];
}

export function transcriptionPrompt(language?: string | null) {
  const code = interviewLanguageCode(language);
  if (code === "ru") {
    return "Business operations interview. Transcribe Russian speech in Cyrillic. Keep product names such as 1C, ArmSoft, Excel, ERP, CRM, SKU, API, WhatsApp, and Telegram in their original form. Armenian or English phrases may appear.";
  }
  if (code === "en") {
    return "Business operations interview in English. Keep product names such as 1C, ArmSoft, Excel, ERP, CRM, SKU, API, WhatsApp, and Telegram in their original form. Armenian or Russian phrases may appear.";
  }
  return "Business operations interview in Eastern Armenian (արևելահայերեն) as spoken in Yerevan. Transcribe Armenian speech in Armenian script. Keep product names such as 1C, ArmSoft, Excel, ERP, CRM, SKU, API, WhatsApp, and Telegram in their original form. Russian or English phrases may appear.";
}

export function sanitizeTranscriptionKeyword(value: string) {
  const keyword = value.replace(/[<>\r\n]/g, " ").replace(/\s+/g, " ").trim();
  if (!keyword) return null;
  return keyword.length > 80 ? keyword.slice(0, 80) : keyword;
}

export function buildTranscriptionKeywords(parts: Array<string | null | undefined> = []) {
  const seen = new Set<string>();
  const keywords: string[] = [];
  for (const part of [...parts, ...DEFAULT_TRANSCRIPTION_KEYWORDS]) {
    const keyword = sanitizeTranscriptionKeyword(part ?? "");
    if (!keyword) continue;
    const key = keyword.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    keywords.push(keyword);
  }
  return keywords.slice(0, 32);
}

export function shouldDropAsClick(elapsedMs: number, minMs = BARGE_IN_MIN_MS) {
  return elapsedMs > 0 && elapsedMs < minMs;
}

export function elapsedMsBucket(elapsedMs: number) {
  if (elapsedMs < 200) return "lt_200";
  if (elapsedMs < 350) return "lt_350";
  if (elapsedMs < 1000) return "lt_1000";
  if (elapsedMs < 5000) return "lt_5000";
  return "gte_5000";
}

export function hashDeviceId(deviceId: string) {
  let hash = 0;
  for (let index = 0; index < deviceId.length; index += 1) {
    hash = (hash * 31 + deviceId.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export type VoiceTurnDetection = {
  type: "semantic_vad";
  eagerness: "low";
  createResponse: boolean;
  interruptResponse: boolean;
};

export function voiceTurnDetection(createResponse: boolean, interruptResponse = false): VoiceTurnDetection {
  return {
    type: VOICE_TURN_CONFIG.type,
    eagerness: VOICE_TURN_CONFIG.eagerness,
    createResponse,
    interruptResponse,
  };
}

export type RealtimeInputAudioOptions = {
  createResponse: boolean;
  language?: string | null;
  keywords?: string[];
  interruptResponse?: boolean;
};

export function sdkInputAudioConfig(options: RealtimeInputAudioOptions) {
  const turn = voiceTurnDetection(options.createResponse, Boolean(options.interruptResponse));
  return {
    turnDetection: {
      type: turn.type,
      eagerness: turn.eagerness,
      createResponse: turn.createResponse,
      interruptResponse: turn.interruptResponse,
    },
    noiseReduction: {
      type: REALTIME_NOISE_REDUCTION.type,
    },
    transcription: {
      model: REALTIME_TRANSCRIBE_MODEL,
      languages: transcriptionLanguages(options.language),
      prompt: transcriptionPrompt(options.language),
      keywords: options.keywords ?? DEFAULT_TRANSCRIPTION_KEYWORDS,
      delay: REALTIME_TRANSCRIBE_DELAY,
    },
  };
}

export function wireInputAudioConfig(options: RealtimeInputAudioOptions) {
  const sdk = sdkInputAudioConfig(options);
  return {
    turn_detection: {
      type: sdk.turnDetection.type,
      eagerness: sdk.turnDetection.eagerness,
      create_response: sdk.turnDetection.createResponse,
      interrupt_response: sdk.turnDetection.interruptResponse,
    },
    noise_reduction: {
      type: sdk.noiseReduction.type,
    },
    transcription: {
      model: sdk.transcription.model,
      languages: sdk.transcription.languages,
      prompt: sdk.transcription.prompt,
      keywords: sdk.transcription.keywords,
      delay: sdk.transcription.delay,
    },
  };
}
