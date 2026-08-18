const SENSITIVE_KEYS = new Set([
  "transcript",
  "content",
  "contentText",
  "instructions",
  "prompt",
  "audio",
  "clientSecret",
  "apiKey",
  "authorization",
]);

function scrub(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrub);
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    if (SENSITIVE_KEYS.has(key)) {
      out[key] = typeof nested === "string" ? `[redacted:${nested.length}]` : "[redacted]";
      continue;
    }
    out[key] = scrub(nested);
  }
  return out;
}

export function previewText(text: string, max = 48) {
  const value = text.replace(/\s+/g, " ").trim();
  if (!value) return "";
  return value.length <= max ? value : `${value.slice(0, max)}…`;
}

export function summarizeUnknownError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return { name: err.name, message: previewText(err.message, 240) };
  }
  if (typeof err === "string") return { message: previewText(err, 240) };
  if (!err || typeof err !== "object") return { message: String(err) };

  const rec = err as Record<string, unknown>;
  const nested =
    rec.error && typeof rec.error === "object" ? (rec.error as Record<string, unknown>) : rec;
  const message = nested.message ?? rec.message;
  return {
    event: typeof rec.type === "string" ? rec.type : undefined,
    name: typeof nested.name === "string" ? nested.name : undefined,
    type: typeof nested.type === "string" ? nested.type : undefined,
    code: typeof nested.code === "string" || typeof nested.code === "number" ? nested.code : undefined,
    message: typeof message === "string" ? previewText(message, 240) : undefined,
  };
}

const BENIGN_REALTIME_CODES = new Set([
  "response_cancel_not_active",
  "conversation_already_has_active_response",
  "input_audio_buffer_commit_empty",
]);

export function isBenignRealtimeError(err: unknown): boolean {
  const summary = summarizeUnknownError(err);
  const code = String(summary.code ?? "");
  const type = String(summary.type ?? "");
  const message = String(summary.message ?? "").toLowerCase();
  if (BENIGN_REALTIME_CODES.has(code)) return true;
  if (type === "invalid_request_error" && (message.includes("no active response") || message.includes("cancellation failed"))) {
    return true;
  }
  if (message.includes("cancellation failed: no active response")) return true;
  return false;
}

export function interviewLog(event: string, fields: Record<string, unknown> = {}) {
  const payload = {
    event,
    ts: new Date().toISOString(),
    ...((scrub(fields) as Record<string, unknown>) ?? {}),
  };
  console.info("[interview]", payload);
  if (typeof window !== "undefined") {
    enqueueClientTrace(event, payload);
  }
}

export function isDevInterviewDebug() {
  return process.env.NODE_ENV !== "production";
}

type ClientTraceContext = { token: string; interviewId: string };

let clientTraceContext: ClientTraceContext | null = null;
const traceQueue: Array<Record<string, unknown>> = [];
let flushTimer: number | null = null;
const TRACE_FLUSH_MS = 280;

export function configureClientInterviewTrace(context: ClientTraceContext | null) {
  clientTraceContext = context;
  if (!context && flushTimer != null) {
    window.clearTimeout(flushTimer);
    flushTimer = null;
  }
}

function enqueueClientTrace(event: string, payload: Record<string, unknown>) {
  if (process.env.NODE_ENV === "production") return;
  traceQueue.push(payload);
  if (traceQueue.length > 80) traceQueue.splice(0, traceQueue.length - 80);
  if (flushTimer != null) return;
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    void flushClientTraces();
  }, TRACE_FLUSH_MS);
}

export async function flushClientTraces(useBeacon = false) {
  if (typeof window === "undefined") return;
  if (!clientTraceContext || traceQueue.length === 0) return;
  const events = traceQueue.splice(0, traceQueue.length);
  const body = JSON.stringify({
    interviewToken: clientTraceContext.token,
    interviewId: clientTraceContext.interviewId,
    events,
  });
  try {
    if (useBeacon && typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon("/api/interviews/trace", new Blob([body], { type: "application/json" }));
      return;
    }
    await fetch("/api/interviews/trace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
  } catch {
    // tracing must never break the interview
  }
}
