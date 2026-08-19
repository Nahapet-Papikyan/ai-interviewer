# Transcript reliability, heuristics, runtime state, and text fallback

Official constraint: [Realtime transcription](https://developers.openai.com/api/docs/guides/realtime-transcription) states that completion events for different items may arrive **out of order** and must be matched with `item_id`. Input transcription is asynchronous; the transcript of the latest utterance can arrive **after** response generation has started ([Agents SDK build guide](https://openai.github.io/openai-agents-js/guides/voice-agents/build/)).

## How transcripts enter the system

```text
Realtime item (SDK history)
  itemId, role, content[].transcript | content[].text
        │
        ▼
extractTurns()          → providerEventId = itemId
mergeTurns()            → index-aligned, keep longer same-role text
rememberPersistEventId  → skip POST if all ids already seen
debounce 450ms
        │
        ▼
POST /api/interviews/session action=history
        │
        ▼
withInterviewLock (in-memory Map, this instance only)
planTranscriptUpsert
  normalizeTurns (dedupe by providerEventId in the payload)
  commonPrefixLength (index + role + prefix/equal content)
  UPDATE longer prefix rows
  INSERT only incoming.slice(existing.length)
        │
        ▼
InterviewMessage (unique interviewId+sequenceNo)
```

Assistant audio transcripts use the same `history_updated` path (`part.transcript || part.text`). There is no separate handler for `conversation.item.input_audio_transcription.completed`.

Partial vs final: the client prefers the **longer** string for the same index/role. It does not store `partialText` vs `finalText`. The first time an `itemId` is seen, `rememberPersistEventId` returns true and a POST is scheduled. Later updates with the **same** id return false; if **every** incoming id is old, the function **returns without posting**, so the longer final text never reaches the server until `complete` sends `latestTurnsRef`.

Complete flush: `endInterview` / `mark_interview_complete` POST the merged client array. That recovers finals **if the tab is still alive**. Refresh, crash, or multi-instance complete races lose them.

Reconnect restore: last 24 user/assistant turns as `conversation.item.create` text items (`restoreWindow`). Provider ids are not used as `previous_item_id`. Partial in-flight audio is gone (audio is not stored; `historyStoreAudio` is not enabled).

## Failure scenarios

### Late completion modifies an earlier turn

`commonPrefixLength` walks index 0..n. If incoming history reorders or a late final for item A is shorter/longer than the DB row at the same index but different `providerEventId`, the planner can write item A’s text onto sequence 3 because both are `role=user` and one string prefixes the other.

### Two user turns complete out of order

Planner assumes arrival order equals sequence. Official docs say not to assume that. Two user completions can insert in the wrong order or skip the late one if `existingIds` already has it while `incoming.slice(existing.length)` does not include the earlier hole.

### Consecutive turns share the same role

`normalizeTurns` drops only **identical** consecutive role+content. Two different user utterances in a row are kept. `mergeTurns` when `incoming.length < previous.length` only patches the last same-role turn — a second user turn can be dropped on the client.

### Browser reconnects with partial history

Server sends last 24. Older evidence still exists in DB for the analyzer, but the live model forgets it. Opening is suppressed. If those 24 rows still have truncated text (bug: persist skip), the model continues from truncated facts.

### Completion happens before final transcription

Agents SDK: transcript can lag the response. `extractTurns` skips empty content, so a user item may be absent from an early `history_updated`, then appear later. If a later payload is shorter than DB `existing.length`, **no inserts** happen (`incoming.slice(existing.length)` is empty). Updates only apply inside the prefix.

### Two serverless instances persist simultaneously

`transcriptLocks` is a process `Map`. Two Vercel instances both read `existing`, both choose the same `nextSequence`, one `createMany` hits unique `(interviewId, sequenceNo)` and `skipDuplicates` silently drops a real turn.

### Multiple tabs, same invitation

Two WebRTC sessions, two persist-id Sets, two openings possible (module Set is per tab). History POSTs interleave. Token mint increments `connectionGeneration` independently.

---

### [P0] Same `itemId` blocks later transcript persistence

Status: Confirmed bug

Evidence:
- File: `src/lib/interview/client-session.ts` 84–97; `InterviewClient.tsx` 656–658
- Function or lines: `rememberPersistEventId`, `persistHistory`
- Current behavior: first event id is remembered; subsequent longer transcripts with that id skip the history POST.

Why it matters:
- User impact: live captions look complete; after refresh they shrink.
- Data impact: analyzer sees truncated user evidence.
- Production impact: silent loss, no error log.

Recommended change:
1. Remember ids for **deduping identical payloads**, not for skipping growth.
2. Persist when content length increases or `status` moves partial → final.
3. Unique `(interviewId, providerEventId)` upsert on the server.

Acceptance criteria:
- [ ] Updating the same `providerEventId` with longer text writes the DB.
- [ ] Duplicate identical payloads do not create a second row.
- [ ] Regression test with two `history_updated` events, same itemId.

Dependencies: none. Risk: Low. Size: S

### [P0] Upsert planner assumes completion order and array index

Status: High-risk design

Evidence:
- File: `src/lib/interview/messages.ts` `commonPrefixLength` 32–45, `planTranscriptUpsert` 56–98
- Current behavior: matches by index; inserts only `incoming.slice(existing.length)`; skips known ids in that tail only.

Official API: match by `item_id`; ordering across items is not guaranteed.

Recommended change: identity = `providerEventId`. Sequence assigned at first insert; never reuse. Late finals UPDATE by id. Missing id APPEND. Do not rewrite an earlier sequence because a prefix string matches.

Acceptance criteria:
- [ ] Out-of-order completions of item B then A store A then B in speech time if timestamps exist, or in first-seen order without overwriting A’s text onto B.
- [ ] Tests from `10_TEST_AND_EVALUATION_PLAN.md` pass.

Dependencies: schema unique on providerEventId. Risk: Medium. Size: M

## Recommended persistence model

```text
interviewId
providerItemId        -- Realtime item_id, unique per interview when present
previousItemId        -- optional chain
role
partialText
finalText
status                -- PARTIAL | FINAL | ERROR
source                -- realtime | manual | text_agent
createdAt
completedAt
providerSequence      -- optional from provider
sequenceNo            -- durable display order
```

Constraints:

- `UNIQUE (interviewId, sequenceNo)` keep.
- `UNIQUE (interviewId, providerItemId)` where providerItemId IS NOT NULL.
- Do not unique-index null provider ids (text fallback rows).

Migration: additive columns; backfill `providerItemId` from `providerEventId`; backfill `finalText = contentText`, `status = FINAL`. Keep `contentText` as generated/stored copy of `finalText ?? partialText` during transition.

Idempotent upsert: `ON CONFLICT (interviewId, providerItemId) DO UPDATE` set longer/final text only (`char_length` monotonic, or status FINAL wins).

---

## Transcript-quality heuristics

File: `src/lib/interview/transcript-quality.ts`. Used in the browser (`persistHistory`) and server (`decideRecordKeyFact`).

The code does **not** delete `InterviewMessage` rows. It can:

- cancel the in-flight assistant response;
- inject a system note (`NOISE_IGNORE_NOTE` or `qualitySystemNote`);
- refuse to record a fact.

Empty user strings are skipped in `extractTurns` / `normalizeTurns` (not stored). Duration-based buffer clear prevents creation (audio never transcribes).

| Rule | Intention | False positive | False negative | Languages | Code-switch conflict |
| --- | --- | --- | --- | --- | --- |
| unexpected_script (CJK/Arabic/Thai) | catch wildly wrong STT | rare proper nouns | garbled Armenian that stays in Armenian script | OK | no |
| run_on_token (Armenian token ≥22 chars) | jammed STT | compound words, URLs pasted in text mode | spaced-out garbage | hy | low |
| number_word_salad | jammed number words | listing մի քանի թվեր quickly | “ութսուն” alone | hy | n/a |
| mixed_unexpected_language (Armenian + ≥2 Latin words + Swedish/English function words) | catch `Motografen som har …` style failures | “the ERP and Excel” inside Armenian | Russian-only garbage | hy-centric | **yes** — `the/and/with/from` appear in English business talk |
| mixed_script_fragment (hy + ≥3 Latin words, length <80) | mixed junk | normal “Excel, CRM, API” sentences | long mixed garbage | hy | **yes** |
| triple_script_fragment | hy+ru+en snippet <40 chars | real code-switch short answers | longer salad | all | **yes** |
| `isNoiseTranscript` length ≤2 | drop clicks | **`ոչ` is 2 chars** — wait: ARMENIAN_ACK includes `ոչ`, so `ոչ` is kept. Bare `ու` / initials are dropped | longer noise words | ack lists hy/ru only | English `ok` kept by LATIN_FILLER as noise (intentional) |
| LATIN_FILLER whole-string | drop `okay`/`yeah` | English `yes`/`no` as real answers **classified as noise** | — | **breaks English interviews** | yes |
| no Armenian/Cyrillic and length <16 | drop Latin crumbs | **English short answers** (`Excel`, `CRM`, `invoices`) | — | **breaks en** | yes |
| no hy/ru, Latin ≥3 letters, length <40 | drop English phrases | entire English clauses | — | **breaks en** | yes |
| `so|then|gotcha|okay` prefix | drop English fillers | “So we use 1C…” | — | mixed | yes |

`looksLikeCriticalNumberUtterance` uses digits, Armenian number words, and Armenian unit words only (`անգամ|պատվեր|…`). Russian `раз` / `заказ` / English `orders` do not trigger number clarification.

### [P1] Noise heuristics treat legitimate English (and some mixed) answers as noise

Status: Confirmed bug / High-risk design

Evidence:
- File: `transcript-quality.ts` `isNoiseTranscript` 91–112
- Function or lines: Latin filler and “no Armenian/Cyrillic” branches
- Current behavior: `persistHistory` cancels the assistant and injects `NOISE_IGNORE_NOTE` for those strings. They may still persist if they passed `extractTurns` before the noise branch — they are still in `next` and may POST. The assistant is told to ignore them.

Why it matters:
- User impact: English `yes` can be ignored; mixed “Excel and CRM” may trigger clarification.
- Data impact: facts from those turns may be rejected (`decideRecordKeyFact`).
- Production impact: `language=en` interviews are not first-class.

Recommended change:
1. Never cancel a response solely because of heuristics.
2. Attach `quality: { suspicious, reasons }` to the message; do not drop source text.
3. Make rules language-aware (`interview.language` + detected scripts).
4. Ask clarification only for critical number/system categories, once per item id.
5. Log false-positive rate; human review queue.

Acceptance criteria:
- [ ] Source user text is always stored when STT returns it.
- [ ] English `yes` / `no` are not classified as noise when interview language is `en`.
- [ ] `ոչ` / `հա` / `այո` remain non-noise.
- [ ] Latin product names inside Armenian are not auto-clarified.

Dependencies: none. Risk: Medium. Size: M

Safer architecture:

- never delete recognized source text;
- attach a quality state;
- preserve original output;
- ask clarification only for critical information;
- support human review;
- make quality rules language-aware;
- measure false-positive rates.

---

## Runtime state and reconnection

State object: `InterviewRuntimeState` in `runtime-state.ts`, stored as `Interview.state` JSON.

Phases: INITIALIZING → AWAITING_CONSENT → DISCOVERY → DEEP_DIVE → PRIORITIZATION → PILOT → CLOSING → COMPLETED.

There is **no reducer**. Client refs (`endingRef`, `listeningOpenRef`, `introPendingRef`, `pendingToolsRef`, `reconnects`, `aiSpeakingRef`, …) plus server JSON plus module Maps (`connections`, `openingTriggered`, `persistEventIds`, `transcriptLocks`).

Races / issues:

- `persistRuntime` is fire-and-forget; no retry.
- Client can PATCH arbitrary phase via `action=runtime` (token auth only).
- `openingDelivered` is OR-merged and never resets (good for no double opening; bad if a false persist happens before audio).
- `reconnects.current` never returns to 0.
- `openingTriggered` Set never evicted.
- `transcriptLocks` Map never evicted.
- `hydrateRuntimeState` infers consent from any user message after an assistant message — a noise user turn can mark consent.
- Invalid transitions: `status.ts` does not include INVITED→STARTED; token route still requests it.
- COMPLETED interviews cannot reconnect (`shouldConnectRealtime`).

### [P1] Reconnect counter never resets

Status: Confirmed bug

Evidence: `InterviewClient.tsx` 186, 1230–1278. Increment only.

Recommended change: reset to 0 after `SESSION_CONNECT_OK`. Cap consecutive failures, not lifetime failures.

Acceptance criteria:
- [ ] Three isolated blips across 20 minutes still allow voice.
- [ ] Three failures with no successful connect still fall back to text.

Dependencies: none. Risk: Low. Size: XS

Recommended state model (do not implement in this task):

```text
InterviewSessionState
  phase: enum
  consent: none | ui_accepted | voice_confirmed
  opening: pending | delivered | skipped_reconnect
  connection: idle | connecting | live | reconnecting | text | ended | failed
  generation: number
  listening: closed | open
  assistant: idle | speaking | interrupting
  activeProcessId: string | null
  coveredFields: Set<string>
  facts: { confirmed, uncertain }
  completion: open | flushing | completed
```

Apply patches through one reducer. Persist server snapshot on generation bump, consent, complete, and every N seconds. Client treats server snapshot as source of truth on load.

---

## Text fallback

When voice dies after 3 reconnects, UI sets `status=text` and shows an Armenian message. `sendText`:

- if `sessionRef` and `status===live` → `session.sendMessage` (Realtime, assistant can answer);
- else POST `action=text` and append a local user bubble.

Server creates a `MessageRole.user` row, `source: manual`. No model call. No tools. No runtime phase update.

Incomplete relative to `Docs/01_IMPLEMENTATION.md` (“microphone denied → offer text interview”).

Proposed architecture (Phase 5):

- Shared `InterviewEngine` on the server: prompt template, runtime state, tools (`record_*` as server functions), `planTranscriptUpsert`.
- Voice path: Realtime tools POST into that engine (current).
- Text path: `client.responses.create` (or `.parse` only for analysis) with the same instructions + transcript + runtime, tools as function calls executed server-side.
- Switching: do not reset opening/phase; add a system message “respondent switched to text” / “voice restored”.
- Modalities: text replies never use Realtime audio; if voice returns, restore last 24 turns as today.

Without this, voice failure cannot meet the 20–30 interview milestone for respondents who deny the microphone.
