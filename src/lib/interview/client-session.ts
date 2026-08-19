type ConnectionRecord = {
  generation: number;
  connecting: boolean;
  teardownTimer: number | null;
  close: (() => void) | null;
};

const connections = new Map<string, ConnectionRecord>();
const openingTriggered = new Set<string>();
const persistEventLengths = new Map<string, Map<string, number>>();

function record(token: string): ConnectionRecord {
  const existing = connections.get(token);
  if (existing) return existing;
  const created: ConnectionRecord = {
    generation: 0,
    connecting: false,
    teardownTimer: null,
    close: null,
  };
  connections.set(token, created);
  return created;
}

export function nextConnectionGeneration(token: string): number {
  const current = record(token);
  current.generation += 1;
  current.connecting = true;
  return current.generation;
}

export function currentConnectionGeneration(token: string): number {
  return record(token).generation;
}

export function isCurrentGeneration(token: string, generation: number): boolean {
  return record(token).generation === generation;
}

export function markConnecting(token: string, value: boolean) {
  record(token).connecting = value;
}

export function isConnecting(token: string): boolean {
  return record(token).connecting;
}

export function registerSessionClose(token: string, close: () => void) {
  record(token).close = close;
}

export function closeInterviewConnection(token: string) {
  const current = record(token);
  current.generation += 1;
  current.connecting = false;
  current.close?.();
  current.close = null;
}

export function scheduleConnectionTeardown(token: string, delayMs = 400) {
  const current = record(token);
  if (current.teardownTimer != null) window.clearTimeout(current.teardownTimer);
  current.teardownTimer = window.setTimeout(() => {
    current.teardownTimer = null;
    closeInterviewConnection(token);
  }, delayMs);
}

export function cancelConnectionTeardown(token: string) {
  const current = record(token);
  if (current.teardownTimer == null) return;
  window.clearTimeout(current.teardownTimer);
  current.teardownTimer = null;
}

export function markOpeningTriggered(token: string) {
  openingTriggered.add(token);
}

export function wasOpeningTriggered(token: string): boolean {
  return openingTriggered.has(token);
}

export function rememberPersistEventId(token: string, eventId: string, contentLength = 0): boolean {
  let lengths = persistEventLengths.get(token);
  if (!lengths) {
    lengths = new Map();
    persistEventLengths.set(token, lengths);
  }
  const previous = lengths.get(eventId);
  if (previous != null && contentLength <= previous) return false;
  lengths.set(eventId, contentLength);
  if (lengths.size > 400) {
    const first = lengths.keys().next().value;
    if (first) lengths.delete(first);
  }
  return true;
}

export const TOOL_SILENT_RESULT =
  "Recorded silently. Do not mention this tool. Do not greet or restart. Ask exactly one next interview question.";

export const TOOL_REJECT_RESULT =
  "Do not save this value. The transcript is uncertain. Ask the respondent to repeat it. Do not guess or calculate from it.";

export const NOISE_IGNORE_NOTE =
  "The last user audio was noise, echo, or a non-speech fragment. Ignore it. Do not ask a question. Do not greet or restart. Wait for the next real answer.";

export function openingResponseInstructions(input: { language?: string; firstName?: string }) {
  const language = (input.language || "hy").toLowerCase();
  const name = input.firstName?.trim() ?? "";
  if (language === "en" || language.startsWith("en")) {
    const greet = name ? `Start with "Hello, ${name}".` : "Greet them without using a name.";
    return `The respondent just enabled the microphone and is listening. Speak first now, in English. ${greet} Briefly introduce yourself as an AI interviewer, thank them, say you want to understand recurring time-consuming processes, it usually takes 15–20 minutes, ask them not to share business secrets or personal customer data, then ask permission to begin. A few short sentences only. Do not wait for them to speak first.`;
  }
  if (language === "ru" || language.startsWith("ru")) {
    const greet = name ? `Start with «Здравствуйте, ${name}».` : "Greet them without using a name.";
    return `The respondent just enabled the microphone and is listening. Speak first now in Russian. ${greet} Briefly introduce yourself as an AI interviewer, thank them, say you want to understand recurring time-consuming processes, it usually takes 15–20 minutes, ask them not to share business secrets or personal customer data, then ask permission to begin. A few short sentences only. Do not wait for them to speak first. Do not switch to Armenian or English unless the respondent does.`;
  }
  const greet = name ? `Start with «Բարև, ${name}».` : "Greet them without using a name.";
  return `The respondent just enabled the microphone and is listening. Speak first now in Eastern Armenian (արևելահայերեն) as spoken in Yerevan and the Republic of Armenia — not English, not Russian, not Western Armenian. ${greet} Use that given name if provided; never say the word "անուն" or "name". Briefly introduce yourself as an AI interviewer, thank them, say you want to understand recurring time-consuming processes, it usually takes 15–20 minutes, then say they should not share business secrets or personal customer data, and ask «Կարո՞ղ ենք սկսել». Do not say this is a sales call. Do not mention passwords. A few short sentences only. Do not wait for them to speak first.`;
}

export const CONTINUE_RESPONSE_INSTRUCTIONS =
  "This is a continuation. Do not greet, re-introduce yourself, or ask permission to begin. Stay in the current spoken language. Continue from the current topic with one short question only if the last user turn still needs a reply. Otherwise wait.";

export function conversationItemFromTurn(turn: { role: "user" | "assistant"; content: string }) {
  if (turn.role === "user") {
    return {
      type: "message",
      role: "user",
      content: [{ type: "input_text", text: turn.content }],
    };
  }
  return {
    type: "message",
    role: "assistant",
    content: [{ type: "output_text", text: turn.content }],
  };
}
