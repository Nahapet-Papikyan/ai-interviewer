export const DEFAULT_REALTIME_MODEL = "gpt-realtime-2.1";
export const DEFAULT_REALTIME_VOICE = "sage";
export const REALTIME_TRANSCRIBE_LANGUAGE = "hy";
export const REALTIME_TRANSCRIBE_PROMPT =
  "Eastern Armenian (արևելահայերեն) as spoken in Yerevan and the Republic of Armenia. Transcribe in Armenian script. Do not transcribe as Western Armenian or Iranian Armenian.";

export function realtimeModel() {
  return process.env.OPENAI_REALTIME_MODEL?.trim() || DEFAULT_REALTIME_MODEL;
}

export function realtimeVoice() {
  return process.env.OPENAI_REALTIME_VOICE?.trim() || DEFAULT_REALTIME_VOICE;
}
