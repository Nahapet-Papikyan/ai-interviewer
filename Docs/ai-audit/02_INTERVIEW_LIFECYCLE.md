# Interview lifecycle

This traces a successful voice interview, then every important failure path. Filenames and functions are from the current code.

## Successful path

### 1. Company / contact creation

Entry points:

- Admin: `createCompany` / `createContact` in `src/app/(admin)/actions.ts`.
- REST: `issueInterviewInvitation` → `createInterviewInvitation` (`src/lib/interview/invitation-api.ts`, `src/lib/interview/invite.ts`).
- MCP: `handleCall` in `src/lib/mcp/server.ts` → same invite helper.
- Public assessment: `POST` `src/app/api/assessment/start/route.ts` creates a new company every time (`vertical: "public-assessment"`), no reuse.

`createInterviewInvitation` finds a company by case-insensitive name. If missing, it creates one. Contact is reused by email inside that company, else by first/last name. Each call still creates a **new** `Interview`.

### 2. Invitation creation

`createInterviewInvitation` (`invite.ts` 27–123) creates the interview row with `promptVersion: INTERVIEWER_PROMPT_VERSION` (`interviewer-v2`). Admin `createInvitation` (`actions.ts` 99–115) does the same but does not set `promptVersion` explicitly (schema default is `interviewer-v2`).

### 3. Public token generation and hashing

`generatePublicToken()`: 24 random bytes, base64url (`src/lib/tokens.ts`).  
`hashToken()`: SHA-256 hex. Only the hash is stored on `Interview.publicTokenHash` (unique). Plaintext is returned once in `interviewUrl` or the admin redirect query string.

### 4. Interview page loading

`PublicInterviewPage` (`src/app/i/[token]/page.tsx`):

1. `findInterviewByToken` (`session.ts` 11–19).
2. If missing → `notFound()`.
3. If `INVITED` → `setStatus(OPENED)` + event `invitation_opened`.
4. If finished (`COMPLETED` / `ANALYZING` / `ANALYZED` / `REVIEWED` / `FOLLOW_UP_READY`) → static thank-you page.
5. Else render `InterviewClient` with messages, hydrated runtime, `alreadyConsented`.

System/tool messages are remapped to `role: "user"` on this page (lines 55–58).

### 5. Consent

UI: `InterviewClient` consent screen (`1280–1284`, JSX `1360–1388`).  
`acceptConsent` → `sessionAction(token, "consent")`.  
Server: `action === "consent"` (`session/route.ts` 117–122) sets `CONSENTED`, `consentedAt`, runtime `consentReceived`.

Copy is Eastern Armenian only. English/Russian interviews still see Armenian consent UI.

### 6–8. Microphone permission, getUserMedia, preprocessing

`connectVoice` (`InterviewClient` 665+):

1. Gate: `shouldConnectRealtime(interviewStatus)`.
2. `navigator.mediaDevices.getUserMedia` with `echoCancellation`, `noiseSuppression`, `autoGainControl`, `channelCount: 1` (714–721).
3. Tracks start **disabled** (733–735).
4. `AudioContext` created and resumed.
5. `attachProcessedMic` (`mic-processing.ts`) builds highpass 85 Hz + RMS gate. On failure, raw stream is used.

Permission query (`permissions.query({ name: "microphone" })`) runs after consent (1319–1344). Safari may not expose it.

### 9–11. WebRTC transport, ephemeral secret, Realtime session

In parallel with getUserMedia, the client POSTs `/api/realtime/token`.

Token route (`src/app/api/realtime/token/route.ts`):

1. In-memory rate limit 10/min per `x-forwarded-for`.
2. Resolve interview; 409 if finished.
3. Hydrate runtime; `isReconnect = openingDelivered || messages.length > 0`.
4. Increment `connectionGeneration`.
5. Transition OPENED/CONSENTED → STARTED (INVITED → STARTED is attempted but **not allowed** by `status.ts`).
6. `buildInterviewerInstructions` with hypotheses and runtime state.
7. `mintRealtimeClientSecret` (`realtime.ts`) POSTs `https://api.openai.com/v1/realtime/client_secrets`.
8. Returns `clientSecret`, **full `instructions`**, model, voice, `recentTurns` (last 24), `continuation`.

Client:

- `OpenAIRealtimeWebRTC({ mediaStream: sendStream })` (862–884).
- `RealtimeAgent` with tools (886–893).
- `RealtimeSession` with `outputModalities: ["audio"]` and duplicated audio config (894–922).
- `session.connect({ apiKey: data.clientSecret })` (1066).

### 12. Agent and tool configuration

Tools defined in `InterviewClient` `useMemo` (508–577):

| Tool | Server action |
| --- | --- |
| `record_process_candidate` | `process` |
| `record_key_fact` | `fact` → `decideRecordKeyFact` |
| `mark_interview_complete` | `complete` with current turns |

Tools mute the mic via `pendingToolsRef` + `applyMicGate`. Failures return silent fallback strings so the model keeps talking.

### 13. Opening message

`shouldTriggerOpening` (`runtime-state.ts` 228–238) is false if opening already delivered, completed, reconnect, or any assistant turn exists.

If true:

- `markOpeningTriggered(token)` (module Set).
- `persistRuntime({ openingDelivered: true })` (fire-and-forget).
- `response.create` with `openingResponseInstructions({ language, firstName })` (`client-session.ts` 108–117).
- 8s fallback opens listening if audio never starts (1136–1146).

English interviews get an English opening. Russian interviews (`language=ru`) fall through to Eastern Armenian.

If false (reconnect/continue): restore last 24 turns via `conversation.item.create`, inject `CONTINUE_RESPONSE_INSTRUCTIONS`, `openListening()`.

### 14–16. VAD, user speech, user transcription

Initial session: `createResponse: false`. After opening audio ends, `openListening` → `setVadAutoResponse(true)` which sends `session.update` with `create_response: true`.

User speech events:

- `input_audio_buffer.speech_started` → `handleUserSpeechStarted` (433–470).
- `input_audio_buffer.speech_stopped` → `handleUserSpeechStopped` (472–493). Speech shorter than 350ms **clears the input buffer**.

Transcription model is `gpt-live-transcribe` with `language: "hy"` and an Eastern Armenian prompt. Official current docs use `languages` for this model. Deltas land in SDK history; the app reads them from `history_updated`, not from transcription events directly.

### 17. Assistant response generation

After listening is open, semantic VAD with `create_response: true` creates responses. Opening uses manual `response.create`. `audio_start` / `response.created` mark AI speaking. Tools may run between turns.

### 18. Interruption / barge-in

API `interrupt_response` is **false**. Client arms a 350ms timer on speech-start while the assistant is speaking, then calls `session.interrupt()`. Shorter bursts abort barge-in and clear audio. Official Agents SDK / VAD docs support native `interruptResponse: true`.

### 19–21. Transcript extraction, persistence, runtime state

`history_updated` → `persistHistory` (580–663):

1. `extractTurns` maps SDK `itemId` → `providerEventId`.
2. Before listening opens, user turns are filtered out.
3. `mergeTurns` merges by **array index**, not item id.
4. Noise / quality heuristics may inject system notes and cancel the assistant.
5. If every incoming `providerEventId` was already seen, **return without POST**.
6. Else debounce 450ms and POST `action: "history"`.

Server `upsertTranscript` (`session/route.ts` 36–73) serializes per interview via an in-memory `transcriptLocks` Map, then `planTranscriptUpsert` (`messages.ts`). Prefix matching is positional. Inserts only occur for turns past `existing.length`.

Runtime patches (`action: "runtime"`) accept client-supplied phase, facts pointers, and generation. Writes are fire-and-forget from `persistRuntime`.

### 22. Tool calls and fact storage

`decideRecordKeyFact` rejects empty, assistant-sourced, noise, suspicious critical facts, and non-CONFIRMED status. Accepted facts become `InterviewFact` rows and runtime `confirmedFacts`. Uncertain facts are stored only in `Interview.state.uncertainFacts`.

### 23. Reconnection

`session.on("error")` (non-benign, not during tools) → `attemptReconnect` (1230–1278). Up to 3 attempts, backoff 1s/2s/4s capped at 8s. Counter **never resets**. Continuation is detected server-side. History restore is last 24 turns only.

### 24–25. Completion and final flush

Two paths:

- Tool `mark_interview_complete`.
- UI `endInterview` (1286–1305).

Both POST `action: "complete"` with merged turns, then close WebRTC. Server upserts remaining turns, sets `COMPLETED`, duration, `phase: COMPLETED`. **Analysis is not started.**

### 26–28. Structured analysis, evidence, scoring

Admin clicks Analyze → `POST /api/analysis` with `{ force: true }` → `runInterviewAnalysis` (`analyzer.ts`). Completing an interview does not enqueue analysis (`shouldStartAnalysis` returns false unless `force`).

Evidence is stored with `messageId` looked up by `messageSequence`. Excerpt text is **not** verified against the cited message. Totals are recomputed by `totalFromBreakdown`. FTE is derived in `metrics.ts`, not taken from the model’s `fteMin/Max`. `clusterTag` is the first global tag.

### 29–30. Dashboard and export

Dashboard: `src/app/(admin)/dashboard/page.tsx`.  
Detail: `src/app/(admin)/interviews/[id]/page.tsx`.  
Export: `GET /api/interviews/[id]/export` JSON or `?format=csv` (`export/route.ts`). CSV is process metrics only.

---

## Failure paths

| Failure | User experience | Data risk |
| --- | --- | --- |
| Microphone denied | Modal stays; `micDenied`; idle; can type in the text box | If they type without a live session, only user rows are stored; no assistant |
| Microphone unavailable (`NotFoundError` / `NotReadableError`) | Unavailable modal; idle | Same as denied |
| No `getUserMedia` API | Unavailable modal | Same |
| WebRTC / connect throw (non-permission) | `status=error`, Armenian error string, modal retry | No session; consent already stored |
| Token 409 finished | `status=ended` | Safe |
| Token other error | Thrown → connect failed UI | No Realtime session; page already OPENED/CONSENTED |
| Realtime benign error | Ignored; UI restored to live | Usually none |
| Realtime hard error | Reconnect loop | Partial transcript if persist skip/debounce lost the last turns |
| Transcription failure | Logged as `TRANSPORT_EVENT` if type contains `transcription.failed`; conversation may continue on audio only | Transcript gaps; analyzer later sees incomplete user text |
| Assistant-response failure | Error → reconnect | Same as hard error |
| Tool failure | `runToolSilently` returns fallback; model continues | Fact/process not stored; interview continues |
| Server persist failure | `persistHistory` `.catch(() => undefined)`; UI still shows text | **UI/DB split.** Complete flush may recover if the tab stays open |
| Reconnect exhausted | `status=text`, “continue by text” | Text replies are not generated |
| Incomplete interview | Status stays STARTED/IN_PROGRESS; no auto ABANDONED | Resume via same token is possible; `abandon` action exists but client never calls it |
| Analysis failure | Interview status set to `FAILED`; event `analysis_failed` | Processes from a prior run already deleted inside the failed transaction only if the transaction committed; on throw after claim, status is FAILED and processes may already be gone if delete happened — actually delete is inside the same transaction as create, so rollback should restore. Status is then set FAILED **outside** the transaction. Previous processes remain if transaction rolled back. |
| Duplicate history POSTs | In-memory lock + `skipDuplicates` on `(interviewId, sequenceNo)` | Same text can still fork if two instances plan different nextSequence (multi-tab) |
| Browser refresh | Page reloads messages + runtime; opening should not repeat if assistant messages or `openingDelivered` exist | Unflushed debounce (450ms) and skipped itemId updates can be lost |
| Multiple tabs | Each tab has its own WebRTC session and persist-id Set | Duplicate openings possible across browsers; transcript races; two Realtime bills |
| Slow network | Token and history fetch can stall; reconnects add delay | Debounced history may never land if the tab dies |
| Switch to text while live | `sendMessage` into Realtime; assistant can reply in voice | OK |
| Switch to text after voice death | `action=text` stores user only | Interview stalls; no model reply |
| INVITED token mint without OPENED | `canTransition(INVITED, STARTED)` is false | Session can start while DB status stays INVITED |

### [P0] Short speech is deleted from the input buffer

Status: Confirmed bug

Evidence:
- File: `src/components/interview/InterviewClient.tsx`
- Function or lines: `handleUserSpeechStopped` 472–493
- Current behavior: if `elapsed < BARGE_IN_MIN_MS` (350), send `input_audio_buffer.clear`.

Why it matters:
- User impact: `հա`, `այո`, `ոչ`, and short numbers never reach the model.
- Data impact: no user message, no evidence.
- Production impact: interviews look like the respondent is silent or uncooperative.

Recommended change:
1. Clear the buffer only when cancelling barge-in of non-speech clicks **and** listening is already producing a false VAD start, or never clear on duration alone.
2. Keep barge-in delay if custom interruption is retained, but do not drop committed audio.
3. Measure clipped-answer rate on the gold set.

Acceptance criteria:
- [ ] Spoken `այո` / `ոչ` / `հա` appear as user turns.
- [ ] Click/noise shorter than 350ms does not barge in.
- [ ] Unit or fixture test covers duration < 350ms without `input_audio_buffer.clear`.

Dependencies: none.

Risk: Medium (more false barge-ins if only the timer is removed).

Estimated size: S

### [P1] Text fallback does not generate a reply

Status: Confirmed bug

Evidence:
- File: `src/components/interview/InterviewClient.tsx` `sendText` 1307–1317; `session/route.ts` 264–281
- Function or lines: `sendText`, `action === "text"`
- Current behavior: stores one user `InterviewMessage`, returns `{ ok: true }`.

Why it matters:
- User impact: after reconnect exhaustion the UI says they can continue by text, then nothing answers.
- Data impact: one-sided transcript.
- Production impact: failed-voice interviews cannot be salvaged.

Recommended change: see Phase 5 in `09_IMPLEMENTATION_TODO.md`.

Acceptance criteria:
- [ ] Text-only turns receive an assistant reply sharing tools/runtime/transcript.
- [ ] Voice can resume later without restarting.

Dependencies: Responses API.

Risk: Medium

Estimated size: L
