# Test and evaluation plan

Current automated suite: `npm test` → **22 passing** tests in `src/lib/interview/*.test.ts`. No tests under `src/lib/openai/`. ESLint currently fails (`VoiceOrb` refs). CI does not run tests or lint.

Do not treat today’s tests as coverage of audio, WebRTC, or STT. They cover opening gates, fact rejection, FTE contradiction, noise heuristics, and prompt wiring.

---

## Automated tests

### Unit tests (extend `tsx --test`)

| Area | File | Cases |
| --- | --- | --- |
| Opening | `lifecycle.test.ts` | already: once, reconnect, remount |
| Facts | `facts.ts` tests | garbled numbers, assistant source, confirmation helper actually used by server |
| Metrics | `metrics.ts` | unreliable volume → null; 22-day derivation; contradiction |
| Quality | `transcript-quality.ts` | `հա`/`այո`/`ոչ` kept; English `yes` when lang=en kept; `Excel and CRM` in Armenian not noise; CJK still suspicious |
| Flags | new `flags.test.ts` | default mic processing false |
| Transcription factory | new `realtime-config.test.ts` | `languages` present, `language` absent; ru vs hy order; keyword sanitizer |
| Opening copy | `client-session.ts` | ru/en/hy strings |

### Event-reducer tests (Phase 5)

Pure `reduce(state, event)` fixtures:

- `SPEECH_STARTED` while opening → ignore
- `OPENING_AUDIO_ENDED` → listening open
- `BARGE_IN` → assistant idle
- `TOOL_START` / `TOOL_END` → mic gate
- `RECONNECT_OK` → generation++, opening skipped
- `COMPLETE` → terminal, ignore speech

No Realtime SDK in these tests.

### Transcript-order tests (Phase 3, P0)

File: `src/lib/interview/messages.test.ts`

1. Same `providerEventId`, longer final text → one UPDATE, no second INSERT.
2. Completions arrive B then A (both user) → two rows, texts not swapped.
3. Partial then FINAL for one id → `status=FINAL`, `finalText` set.
4. Consecutive user turns different ids → both stored.
5. Empty content skipped.
6. `planTranscriptUpsert` with incoming shorter than existing does not delete rows.
7. Duplicate identical payload → skip.

### Reconnect tests

- `shouldTriggerOpening` false when `isReconnect` or `openingDelivered`.
- Restore window length 24.
- Reconnect counter: after success, consecutive failures reset (once implemented).
- Completed status: `shouldConnectRealtime` false (already Test J).

### API validation tests

Use Next route handlers with mocked Prisma:

- session history > max turns → 400
- session runtime `phase: "HACK"` → 400
- session without token → 404
- analysis without admin cookie → 401
- MCP tools/call without key → 401 (after T7.1)
- login 5+ times → 429 (after T7.2)
- invitations without Bearer → 401
- assessment 7th time same IP → 429 (instance-local until Redis)

### Analyzer evidence tests

File: `src/lib/openai/evidence.test.ts` + analyzer helpers extracted from `analyzer.ts`

- EXPLICIT + user message containing excerpt → keep
- EXPLICIT + assistant message → INFERRED
- EXPLICIT + missing sequence → not EXPLICIT, numeric derivation skipped
- excerpt not a substring → reject
- two processes two taxonomy tags
- `totalFromBreakdown` ignores model total
- contradictory labor → null FTE (already)

### Scoring tests

`scoring.ts`: penalties negative; clamp 0–100; missing components.

### Security tests

- `hashToken` is hex 64 chars; `generatePublicToken` length.
- `checkAdminPassword` does not throw if `ADMIN_PASSWORD` unset (returns false).
- Token route response fixture must not include `hypotheses` after T7.3.
- `interviewPublicBaseUrl` production ignores origin.

Run in CI: `npm test && npx eslint src && npm run build`.

---

## Armenian audio evaluation

Use `src/eval/armenian-utterances.md` as the seed list. Record a **controlled gold set** (same reader, same room, then variants). Do not store production respondent audio if policy remains “no raw audio”; keep the gold set in a private drive, not git.

### Gold-set matrix

Each cell: 3 takes. Score STT (exact / acceptable / fail) and whether the **application** stored the text.

| Slice | Examples | Pass if |
| --- | --- | --- |
| Quiet speech | laptop 30cm, 50% volume | no missing first consonant |
| Normal speech | conversational | WER/semantic OK |
| Loud speech | close mic | no clipping artifacts in STT |
| Background noise | café-level talk radio | semantic VAD does not cut mid-sentence |
| Long pauses | 1–2s mid-thought | turn not finalized early (`eagerness=low`) |
| Short answers | `հա`, `այո`, `ոչ`, `լավ` | stored; assistant does not ignore |
| Numbers | 80 vs 8, 1500, 6 minutes | exact |
| Currencies | դրամ, AMD, USD | exact code/word |
| Company names | gold-set names + respondent company | recognizable |
| 1C | «մեկ սի», «1C», «один эс» | not random Latin |
| ArmSoft | | kept |
| ERP / CRM / SKU / API | mixed into Armenian sentences | kept in Latin |
| WhatsApp / Telegram | | kept |
| Mixed hy/ru/en | utterances 21–24 in eval file | no forced Armenian script on Russian |
| Corrections | «ոչ, ոչ 8-ը, 80-ն եմ ասում» | final 80 stored |
| Long operational | 45–90s workflow | no mid-answer barge-in |

Also record Bluetooth headset vs MacBook vs a Windows laptop if available.

### Scoring sheet

Copy `src/eval/scorecard.md` rows. Add columns: `clipped_short_answer`, `false_clarification`, `transcript_dup`, `reconnect_ok`.

Target after Phase 1–2 (internal, n≥30 utterances):

- Short-answer capture ≥ 95%
- Critical-number exact ≥ 90%
- False clarification on clean speech ≤ 10%

---

## Voice evaluation

Native Eastern Armenian reviewers (at least one Yerevan professional register). Blind A/B if possible.

Voices: `sage` (current), `marin`, `cedar` (OpenAI quality recommendation), optional `gpt-realtime-2.1-mini` cost check.

Score 1–5:

| Dimension | 1 | 5 |
| --- | --- | --- |
| Pronunciation | unintelligible / Western mix | native Eastern |
| Accent naturalness | TTS / foreign | Yerevan business |
| Trust | salesperson/bot | consultant |
| Number clarity | 80/8 confusion | numbers clear |
| Business tone | slang or grabar | professional warmth |
| Pacing | rushed or lecture | one question, pause |
| Code-switching | forced translation of Excel | natural mixed terms |

Do not change production voice until median naturalness ≥ 4 on 10 scripted turns.

Personas: `src/eval/personas.md` (10). Target: high-value process found in ≥8/10 **after** audio bugs are fixed; do not judge the prompt while short answers are dropped.

---

## VAD evaluation

Same 5 long-pause scripts + 5 short-answer scripts. One variable at a time.

| Condition | Config |
| --- | --- |
| A | semantic `eagerness=low`, `interrupt_response=false`, custom barge-in (today) |
| B | semantic `low`, `interrupt_response=true`, no custom timer (flag) |
| C | semantic `medium`, native interrupt |
| D | semantic `auto`, native interrupt |
| E | if mic gate re-enabled for science, gate on vs off with B |

Metrics: cut-off mid-sentence count; time-to-assistant after `ոչ`; false barge-in from playback echo.

Recommendation rule: prefer the condition with zero clipped `ոչ`/`հա` and ≤1 premature cut per 5 long answers.

---

## Product metrics (instrument after Phase 1 telemetry)

| Metric | Definition | Initial target (n=20 completed) |
| --- | --- | --- |
| Semantic transcription accuracy | human: meaning preserved | ≥ 90% turns |
| Exact critical-number accuracy | volume/time/people digits | ≥ 90% |
| Respondent repeat rate | user asked to repeat | ≤ 15% of turns |
| False clarification rate | clarification when audio was clear | ≤ 10% |
| Clipped-answer rate | short real answers missing from transcript | ≤ 2% |
| Transcript duplication rate | same providerItemId two rows | 0% |
| Transcript loss rate | client showed text, DB missing after complete | 0% on clean complete |
| Reconnect recovery rate | voice restored without re-greeting | ≥ 90% of single disconnects |
| Completion rate | CONSENTED → COMPLETED | track only; no vanity target yet |
| Median response latency | speech_stop → assistant audio_start | measure; no hard SLA until VAD chosen |
| Cost per completed interview | OpenAI Realtime + analysis | log; compare 2.1 vs mini later |

Funnel (already conceptually in dashboard): invited → opened → consented → started → 5+ min → completed → analyzed. Fix dashboard strong/pilot counts to use full corpus before trusting them (`07` / `06`).

---

## Analyzer evaluation

After 10 labeled interviews (`src/eval/quality-gates.md`):

- 100% no fabricated numeric values (enforced by T6.1 tests + human)
- ≥95% exact capture of explicit critical numbers
- ≥90% correct process boundaries
- all derived metrics traceable (22 days / 4.33 weeks / 176 h)
- per-process tags distinct when workflows differ

Human label sheet: process count, volume min/max, minutes, people, systems, pilot, evidence sequence, score band.

---

## Security tests in CI (Phase 7)

Minimal route tests listed above. Add a checklist before outreach:

- [ ] MCP unauthenticated call fails
- [ ] Token JSON has no hypotheses
- [ ] Login rate-limited
- [ ] Production invite URLs use `APP_URL` only
- [ ] `npm test` + eslint + build on every PR
