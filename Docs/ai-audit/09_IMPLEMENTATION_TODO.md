# Implementation TODO

Do not start until the project owner approves this plan. Application code was not changed in the audit.

Flags (add in Phase 0, default to today’s behavior except mic gate which should default **off** once the flag exists):

| Flag | Default after Phase 0 | Rollback |
| --- | --- | --- |
| `FEATURE_MIC_PROCESSING` | `false` | set `true` |
| `FEATURE_NATIVE_INTERRUPT` | `false` | keep custom barge-in |
| `FEATURE_DURATION_BUFFER_CLEAR` | `false` | set `true` only if eval requires |
| `FEATURE_TEXT_AGENT` | `false` | voice-only |
| `FEATURE_AUTO_ANALYSIS` | `false` | admin button |

---

## Phase 0 — Baseline and safety

### T0.1 Capture current behavior
- Priority: P0
- Files: `Docs/ai-audit/` (done), add `src/eval/baseline-notes.md` after first recorded session
- Steps: keep this audit; record one internal hy interview with flags unchanged as baseline audio/transcript dump (admin export JSON).
- DB: none
- Tests: none
- Acceptance:
  - [ ] One baseline JSON export stored off-repo (PII).
- Dependencies: none
- Risk: Low
- Rollback: n/a
- Estimate: XS
- Armenian review: yes (listen to baseline)

### T0.2 Feature flags module
- Priority: P0
- Files: `src/lib/flags.ts`, `.env.example`, token/session/client reads
- Steps: boolean env helpers; InterviewClient reads `FEATURE_MIC_PROCESSING` via token payload (server-evaluated) so the browser cannot enable a hidden processor without server consent.
- DB: none
- Tests: unit tests for env parsing
- Acceptance:
  - [ ] Mic processing off when flag missing/false.
- Dependencies: none
- Risk: Low
- Rollback: remove flags, restore old branches
- Estimate: S
- Armenian review: no

### T0.3 Persist-skip regression test before changing production
- Priority: P0
- Files: `src/lib/interview/lifecycle.test.ts`, new `messages.test.ts`
- Steps: test two history payloads same `providerEventId` longer text; document current **failing** client skip as a test that will flip in T3.x. Add failing-or-characterized test now.
- DB: none
- Tests: as above
- Acceptance:
  - [ ] Characterized tests exist even if client skip still fails until Phase 3.
- Dependencies: none
- Risk: Low
- Rollback: n/a
- Estimate: S
- Armenian review: no

### T0.4 Prisma baseline snapshot
- Priority: P1
- Files: `prisma/` only after owner approval
- Steps: `prisma migrate diff` from empty to current schema into a baseline migration; **do not apply** until a production backup exists.
- DB: baseline migration, no data change
- Tests: `prisma validate`
- Acceptance:
  - [ ] `prisma/migrations` exists in a follow-up PR.
- Dependencies: owner backup
- Risk: High if applied blindly
- Rollback: do not deploy migrate yet
- Estimate: M
- Armenian review: no

---

## Phase 1 — Audio and short-answer fixes

### T1.1 Feature-flag custom mic gate off
- Priority: P0
- Files: `InterviewClient.tsx`, `mic-processing.ts`, `realtime-config.ts`, `flags.ts`
- Steps: only call `attachProcessedMic` when flag true; log `processed: false` by default.
- DB: none
- Tests: none required (flag unit test)
- Acceptance:
  - [ ] Default sessions send the getUserMedia track to WebRTC.
- Dependencies: T0.2
- Risk: Low
- Rollback: `FEATURE_MIC_PROCESSING=true`
- Estimate: S
- Armenian review: yes (quiet speech)

### T1.2 Stop duration-based input buffer clear
- Priority: P0
- Files: `InterviewClient.tsx` `handleUserSpeechStopped`
- Steps: never `input_audio_buffer.clear` solely because `elapsed < BARGE_IN_MIN_MS`. Optionally still cancel barge-in timer.
- DB: none
- Tests: extract handler to a pure function `shouldDropAsClick(elapsed)` used only for UI, not clear.
- Acceptance:
  - [ ] `այո` / `ոչ` / `հա` survive as user turns on gold set.
  - [ ] No `input_audio_buffer.clear` on short speech in production default.
- Dependencies: none
- Risk: Medium (more barge-ins)
- Rollback: restore clear behind `FEATURE_DURATION_BUFFER_CLEAR`
- Estimate: S
- Armenian review: yes

### T1.3 Native interrupt eval flag
- Priority: P1
- Files: `realtime-config.ts`, mint, session.update, InterviewClient barge-in
- Steps: if `FEATURE_NATIVE_INTERRUPT`, set `interrupt_response: true` and skip custom 350ms interrupt (keep `session.interrupt()` for explicit stop if added later).
- DB: none
- Tests: config factory snapshot
- Acceptance:
  - [ ] Flag true → payload `interrupt_response: true`.
  - [ ] Eval scorecard filled for 3 VAD/interrupt combos.
- Dependencies: T0.2
- Risk: Medium
- Rollback: flag false
- Estimate: S
- Armenian review: yes

### T1.4 Audio-pipeline telemetry
- Priority: P1
- Files: `logging.ts`, `InterviewClient.tsx`
- Steps: once per session log `track.getSettings()` (echoCancellation, sampleRate, deviceId hash); count `SPEECH_STOPPED` with elapsedMs buckets; no raw audio.
- DB: optional InterviewEvent `audio_settings`
- Tests: none
- Acceptance:
  - [ ] Admin can see device settings on a test interview event.
- Dependencies: none
- Risk: Low
- Rollback: stop logging
- Estimate: S
- Armenian review: no

---

## Phase 2 — Multilingual transcription

### T2.1 Transcription config factory
- Priority: P0
- Files: `realtime-config.ts`, `realtime.ts`, `InterviewClient.tsx`, `token/route.ts`
- Steps: single `buildInputAudioConfig({ language, keywords, createResponse })`. Use `languages` array **not** `language`. Default hy interviews: `["hy","ru","en"]`. ru: `["ru","hy","en"]`. en: `["en","hy","ru"]`. `delay: "medium"`. Dynamic prompt: do not force Armenian script for ru/en.
- DB: none
- Tests: snapshot per language
- Acceptance:
  - [ ] Mint and session.update payloads omit `language`.
  - [ ] Staging Russian session transcripts Cyrillic.
- Dependencies: none
- Risk: Medium
- Rollback: revert factory
- Estimate: S
- Armenian review: yes (code-switch)

### T2.2 Keywords and transcription prompt
- Priority: P1
- Files: token route, `context.ts`
- Steps: keywords from company name, contact name, vertical, plus fixed list: `1C`, `ArmSoft`, `Excel`, `ERP`, `CRM`, `SKU`, `API`, `WhatsApp`, `Telegram`. Reject `<` `>` newlines per API. Prompt describes “business operations interview; keep product names in original script.”
- DB: none
- Tests: keyword sanitizer
- Acceptance:
  - [ ] Keywords include company name.
  - [ ] Invalid chars stripped.
- Dependencies: T2.1
- Risk: Low
- Rollback: empty keywords
- Estimate: S
- Armenian review: yes (names)

### T2.3 Russian opening + localized UI
- Priority: P1
- Files: `client-session.ts`, `InterviewClient.tsx`, consent copy module
- Steps: `openingResponseInstructions` ru branch; header/consent/end strings by `interview.language` with hy default.
- DB: none
- Tests: extend language-locked opening tests
- Acceptance:
  - [ ] ru opening is Russian; UI not hard-coded `հայերեն`.
- Dependencies: copy review
- Risk: Low
- Rollback: revert strings
- Estimate: M
- Armenian review: yes; Russian native optional

---

## Phase 3 — Transcript identity and persistence

### T3.1 Server upsert by providerItemId
- Priority: P0
- Files: `messages.ts`, `session/route.ts`, `schema.prisma`
- Steps: additive columns; partial unique index; upsert on id; monotonic text; inserts for new ids regardless of array length.
- DB: see `06_ANALYZER_AND_DATA_AUDIT.md`
- Tests: out-of-order completions; duplicate ids; two consecutive user turns
- Acceptance:
  - [ ] Same itemId longer text updates one row.
  - [ ] Out-of-order B then A does not overwrite A onto B’s sequence.
- Dependencies: T0.4 preferred
- Risk: Medium
- Rollback: keep `contentText` column populated
- Estimate: L
- Armenian review: no

### T3.2 Client persist: allow growth of known ids
- Priority: P0
- Files: `client-session.ts`, `InterviewClient.tsx`
- Steps: `rememberPersistEventId` returns whether content changed; always POST on longer text; debounce keyed by generation.
- DB: none
- Tests: lifecycle Test D extended
- Acceptance:
  - [ ] Second history_updated with same id persists.
- Dependencies: T3.1
- Risk: Low
- Rollback: revert client helper
- Estimate: S
- Armenian review: no

### T3.3 Final flush + reconnect
- Priority: P0
- Files: `InterviewClient.tsx`, token route
- Steps: flush on `visibilitychange`/`pagehide` with keepalive; restore by provider ids if SDK supports; keep 24-turn window until full history rehydrate is designed.
- DB: none
- Tests: mock flush called on complete
- Acceptance:
  - [ ] Closing the tab after 500ms debounce still stores last turn (keepalive).
- Dependencies: T3.1
- Risk: Medium
- Rollback: complete-only flush
- Estimate: M
- Armenian review: no

### T3.4 Multi-instance lock
- Priority: P1
- Files: `session/route.ts`
- Steps: replace memory Map with `pg_advisory_xact_lock(hashtext(interviewId))` inside the transaction.
- DB: none besides using Postgres
- Tests: optional
- Acceptance:
  - [ ] Comment + helper; staging note that two tabs do not duplicate sequence.
- Dependencies: T3.1
- Risk: Low
- Rollback: in-memory lock
- Estimate: S
- Armenian review: no

---

## Phase 4 — Armenian prompting and pronunciation

### T4.1 interviewer-v3 short prompt
- Priority: P1
- Files: `src/prompts/interviewer.system.v3.md`, `versions.ts`, `context.ts`
- Steps: structure in `04_ARMENIAN_LANGUAGE_AUDIT.md`; keep v2 file for rollback via `INTERVIEWER_PROMPT_SOURCE`.
- DB: interview.promptVersion string
- Tests: `prompt-version.test.ts` update
- Acceptance:
  - [ ] ≤400 lines; runtime_state still injected; silent tools kept.
- Dependencies: Phase 1–2 stable
- Risk: Medium
- Rollback: point source to v2
- Estimate: M
- Armenian review: **required**

### T4.2 Native-name fields + pronunciation block
- Priority: P2
- Files: schema, admin forms, `context.ts`, token route
- Steps: nullable `Contact.firstNameHy`, `Company.nameHy`; generate Reference Pronunciations section.
- DB: additive columns
- Tests: template replace
- Acceptance:
  - [ ] Empty hy name does not invent spelling.
- Dependencies: T4.1
- Risk: Low
- Rollback: stop injecting block
- Estimate: M
- Armenian review: yes

### T4.3 Voice benchmark
- Priority: P2
- Files: env `OPENAI_REALTIME_VOICE`, `src/eval/scorecard.md`
- Steps: record sage / marin / cedar on the same 10 utterances.
- DB: none
- Tests: none
- Acceptance:
  - [ ] Scorecard filled by native reviewer.
- Dependencies: reviewers
- Risk: Low
- Rollback: stay on sage
- Estimate: S
- Armenian review: **required**

### T4.4 VAD eagerness experiment
- Priority: P2
- Files: realtime-config, eval notes
- Steps: compare low / medium / auto on long pauses vs short answers.
- DB: none
- Acceptance: recorded recommendation
- Dependencies: T1.3
- Risk: Low
- Rollback: keep low
- Estimate: S
- Armenian review: yes

---

## Phase 5 — Text fallback and state machine

### T5.1 Responses API text engine
- Priority: P1
- Files: new `src/lib/interview/text-engine.ts`, `session/route.ts` action `text`
- Steps: load same prompt + runtime + last N turns; `openai.responses.create` with tools executed server-side (reuse fact/process/complete handlers); append assistant message `source: manual`.
- DB: messages
- Tests: mock OpenAI; tool round-trip
- Acceptance:
  - [ ] After reconnect exhaustion, a typed answer gets an assistant reply and a fact can still be stored.
- Dependencies: T3.1
- Risk: Medium
- Rollback: `FEATURE_TEXT_AGENT=false`
- Estimate: L
- Armenian review: yes (text Armenian quality)

### T5.2 Voice/text switching
- Priority: P1
- Files: InterviewClient, runtime-state
- Steps: system note on modality change; do not reset opening; reconnect voice allowed from text status if mic available.
- DB: runtime phase unchanged
- Tests: hydrate tests
- Acceptance:
  - [ ] Switching does not re-greet.
- Dependencies: T5.1
- Risk: Medium
- Rollback: disable switch
- Estimate: M
- Armenian review: no

### T5.3 Reducer + InterviewClient split
- Priority: P2
- Files: new `interview-reducer.ts`, split components
- Steps: single state type from `05_TRANSCRIPT_RELIABILITY_AUDIT.md`; reduce events from transport + UI.
- DB: none
- Tests: reducer event tests
- Acceptance:
  - [ ] InterviewClient &lt; 400 lines.
  - [ ] No duplicate opening on remount tests still pass.
- Dependencies: T5.1 optional
- Risk: Medium
- Rollback: keep monolith branch
- Estimate: XL
- Armenian review: no

---

## Phase 6 — Analyzer correctness

### T6.1 Evidence validation
- Priority: P1
- Files: `analyzer.ts`, `schemas.ts`, new `evidence.ts`
- Steps: EXPLICIT requires user message and excerpt substring; else downgrade; skip derivation if volume evidence invalid.
- DB: none
- Tests: mismatched excerpt fixture
- Acceptance:
  - [ ] Fake excerpt cannot stay EXPLICIT.
- Dependencies: none
- Risk: Medium
- Rollback: skip validator flag
- Estimate: M
- Armenian review: no

### T6.2 Per-process taxonomy
- Priority: P1
- Files: `schemas.ts`, `analyzer.ts`, analyzer prompt
- Steps: `taxonomyTag` per process; stop using `crossInterviewTags[0]`.
- DB: none (uses `clusterTag`)
- Tests: two processes two tags
- Acceptance:
  - [ ] Process explorer splits them.
- Dependencies: none
- Risk: Low
- Rollback: revert mapping
- Estimate: S
- Armenian review: no

### T6.3 Versioned analysis + human overlay
- Priority: P1
- Files: schema, analyzer, interview detail UI
- Steps: `version`, `currentAnalysisId`; never delete old `InterviewAnalysis`; do not wipe `reviewNotes`; optional freeze processes when `REVIEWED` unless `force` + confirm.
- DB: additive
- Tests: reanalyze increments version
- Acceptance:
  - [ ] Previous rawJson readable.
  - [ ] Concurrent analysis: second request no-ops.
- Dependencies: T0.4
- Risk: Medium
- Rollback: keep latest take:1
- Estimate: L
- Armenian review: no

### T6.4 Auto-analysis on complete
- Priority: P2
- Files: session complete, `flags.ts`
- Steps: after COMPLETED, invoke analyzer if flag; same lock as T6.3.
- DB: none
- Tests: shouldStartAnalysis true with flag
- Acceptance:
  - [ ] Completed interview becomes ANALYZED without admin click when flag on.
- Dependencies: T6.3
- Risk: Low (cost)
- Rollback: flag false
- Estimate: S
- Armenian review: no

---

## Phase 7 — Security

### T7.1 MCP + ingest auth
- Priority: P0
- Files: `mcp/route.ts`, `mcp/server.ts`, `Docs/05_INVITE_API.md`
- Steps: require same key/OAuth; CORS not `*` if using cookies; document ChatGPT auth.
- DB: none
- Tests: 401 without key
- Acceptance:
  - [ ] Anonymous tools/call fails.
- Dependencies: owner ChatGPT decision
- Risk: High (breaks plugin)
- Rollback: env to allow unauth **must not** ship
- Estimate: S
- Armenian review: no

### T7.2 Distributed rate limit + login protect
- Priority: P1
- Files: `rate-limit.ts`, login route, session route
- Steps: Upstash/Vercel KV; 5 login attempts / 15 min / IP; session 60/min / interview.
- DB: none
- Tests: mock redis
- Acceptance:
  - [ ] Login 429 after burst.
- Dependencies: KV credentials
- Risk: Low
- Rollback: in-memory
- Estimate: M
- Armenian review: no

### T7.3 Token response privacy + APP_URL fail-closed
- Priority: P1
- Files: `token/route.ts`, `invitation-api.ts`, `realtime.ts`
- Steps: strip hypotheses from any client JSON; production requires `APP_URL`; Safety-Identifier header hashed interviewId.
- DB: none
- Tests: invitation URL unit tests
- Acceptance:
  - [ ] Token JSON has no hypotheses string.
  - [ ] Production missing APP_URL → 500 on invite.
- Dependencies: T2.x if instructions still client-side
- Risk: Medium
- Rollback: restore field
- Estimate: S
- Armenian review: no

### T7.4 Session Zod limits + timing-safe secrets
- Priority: P1
- Files: `session/route.ts`, `ingest-auth.ts`, `auth-token.ts`
- Steps: max body; enum phase; hash-compare API key and password with equal-length buffers.
- DB: none
- Tests: oversized history 413
- Acceptance:
  - [ ] 201 history turns rejected.
- Dependencies: none
- Risk: Low
- Rollback: raise limits
- Estimate: S
- Armenian review: no

---

## Phase 8 — CI/CD and cleanup

### T8.1 CI: test + lint + build
- Priority: P1
- Files: `.github/workflows/ci.yml`, `VoiceOrb.tsx`, companies page
- Steps: add `npm test` and `npx eslint src`; fix VoiceOrb refs via `useEffect` sync; remove unused Link.
- DB: none
- Tests: CI green
- Acceptance:
  - [ ] PR cannot merge with current eslint errors.
- Dependencies: none
- Risk: Low
- Rollback: continue warn-only (not recommended)
- Estimate: S
- Armenian review: no

### T8.2 Stop amending deploy commits; pin Vercel CLI
- Priority: P0
- Files: `vercel-production.yml`, `vercel-preview.yml`
- Steps: delete amend step; pin `vercel@<version>`; choose Git integration XOR Actions; preview env not `Prod`.
- DB: none
- Tests: none
- Acceptance:
  - [ ] Vercel deployment SHA equals GitHub `main` SHA.
- Dependencies: Vercel Hobby author policy
- Risk: High if Hobby still blocks
- Rollback: reintroduce amend only with written owner approval
- Estimate: S
- Armenian review: no

### T8.3 middleware → proxy; Prisma config
- Priority: P2
- Files: `src/middleware.ts` → `src/proxy.ts`, `prisma.config.ts`
- Steps: official Next 16 codemod; Prisma 7 prep without upgrading in the same PR.
- DB: none
- Tests: admin redirect still works
- Acceptance:
  - [ ] Build has no middleware deprecation warning.
- Dependencies: T8.1
- Risk: Medium
- Rollback: keep middleware file
- Estimate: S
- Armenian review: no

### T8.4 Dead prompt archive + docs consolidation
- Priority: P3
- Files: `src/prompts/interviewer.system.md`, `Docs/02`, `Docs/00`, `Docs/04`
- Steps: after v3 ships, move v1 prompt to `Docs/archive/`. Point docs at `src/prompts`. Add `INGEST_API_KEY` to `.env.example`.
- DB: none
- Tests: grep no imports
- Acceptance:
  - [ ] Runtime still v2 or v3 only.
- Dependencies: T4.1
- Risk: Low
- Rollback: restore file
- Estimate: S
- Armenian review: no

### T8.5 Single Realtime config factory
- Priority: P2
- Files: `realtime-config.ts`, mint, client
- Steps: one object; delete unused server-VAD fields; optional `reasoning.effort: low`.
- DB: none
- Tests: snapshot
- Acceptance:
  - [ ] No duplicated transcription blocks.
- Dependencies: T2.1
- Risk: Low
- Rollback: revert factory
- Estimate: S
- Armenian review: no

---

## Suggested sequence

```text
T0.2 flags → T1.1 mic off → T1.2 no buffer-clear → T2.1 languages
    → T3.1–T3.2 persist identity → T7.1 MCP auth
    → T8.1 CI → T8.2 deploy SHA
    → T4.1 prompt v3 (after gold set)
    → T5.1 text engine
    → T6.x analyzer
```
