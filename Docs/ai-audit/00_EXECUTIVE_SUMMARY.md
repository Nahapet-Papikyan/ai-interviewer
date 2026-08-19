# Executive summary — AI Interviewer architecture audit

Date: 2026-08-19  
Scope: full repository analysis and implementation planning. **No application code was changed.**  
Product: 15–20 minute adaptive voice interviews with Armenian businesses to discover automation opportunities.

## Overall architecture assessment

The product is a real customer-discovery engine, not a generic voice chatbot. The core loop is professionally conceived:

1. Admin or ingest creates a company, contact, and opaque invitation token.
2. The respondent opens `/i/{token}`, consents, and connects the browser to OpenAI Realtime over WebRTC.
3. An Eastern Armenian interviewer agent discovers workflows, records provisional facts, and persists a live transcript.
4. An admin later runs a Structured Outputs analyzer that materializes processes, evidence, FTE, and opportunity scores.

The stack is current enough to be viable: Next.js 16.3.1, React 19.2.8, `@openai/agents` 0.4.15, `openai` 6.49.0, Prisma 6.19.3, Zod 4.4.3, `gpt-realtime-2.1`, `gpt-live-transcribe`, Responses API. Permanent OpenAI keys stay on the server. Public tokens are hashed. Analysis distinguishes explicit / inferred / derived values and recomputes FTE in application code.

It is **not yet production-ready for 20–30 reliable interviews**. The implementation has confirmed bugs that can clip short Armenian answers, freeze transcript updates, hard-code Armenian-only transcription during Russian/English interviews, leak the full interviewer prompt and hypotheses to the browser, and allow unauthenticated MCP callers to create database records. Text fallback stores user messages but never generates an assistant reply. Analysis is manual and assigns the same cluster tag to every process.

The first implementation phase should stabilize audio, short answers, and transcription identity. Prompt rewriting and analyzer sophistication should wait until those layers stop losing evidence.

## Installed versions

| Package | package.json | lockfile resolved |
| --- | --- | --- |
| next | 16.3.1 | 16.3.1 |
| react / react-dom | 19.2.8 | 19.2.8 |
| openai | ^6.8.1 | 6.49.0 |
| @openai/agents | ^0.4.0 | 0.4.15 |
| @prisma/client / prisma | ^6.16.2 | 6.19.3 |
| zod | ^4.1.12 | 4.4.3 |
| typescript | ^5 | (dev) |
| eslint-config-next | 16.3.1 | 16.3.1 |

Environment names (from `.env.example` only): `DATABASE_URL`, `OPENAI_API_KEY`, `OPENAI_REALTIME_MODEL`, `OPENAI_REALTIME_VOICE`, `OPENAI_ANALYSIS_MODEL`, `ADMIN_PASSWORD`, `AUTH_SECRET`, `FTE_HOURS_PER_MONTH`, `APP_URL`. `INGEST_API_KEY` is used in code and docs but is **missing from `.env.example`**.

## Official documentation used

- Next.js 16 local docs under `node_modules/next/dist/docs/`, especially `01-app/01-getting-started/16-proxy.md` (middleware renamed to proxy).
- [Realtime transcription](https://developers.openai.com/api/docs/guides/realtime-transcription)
- [Realtime VAD](https://developers.openai.com/api/docs/guides/realtime-vad)
- [Realtime WebRTC](https://developers.openai.com/api/docs/guides/realtime-webrtc)
- [Realtime conversations](https://developers.openai.com/api/docs/guides/realtime-conversations)
- [gpt-realtime-2.1](https://developers.openai.com/api/docs/models/gpt-realtime-2.1)
- [Agents SDK voice agents](https://openai.github.io/openai-agents-js/guides/voice-agents/build/)

## The ten most important findings

1. **P0 — Custom microphone gate plus duration-based buffer clear can drop short Armenian answers** (`այո`, `ոչ`, `հա`, numbers).
2. **P0 — Client persist skip on the same `itemId` freezes mid-session transcript growth.**
3. **P0 — Transcription is hard-coded to singular `language: "hy"`; official `gpt-live-transcribe` uses `languages` and rejects sending both.**
4. **P0 — Unauthenticated MCP endpoint with CORS `*` can create companies, contacts, and interview links.**
5. **P0 — GitHub Actions amends the deploy commit, so Vercel can ship a SHA that is not GitHub `main`.**
6. **P1 — Text fallback never calls a model; the respondent’s messages are stored with no assistant reply.**
7. **P1 — Reconnect counter never resets after a successful reconnect.**
8. **P1 — Full interviewer prompt, verified facts, and hypotheses are returned to the browser in the token JSON.**
9. **P1 — Analyzer assigns `crossInterviewTags[0]` to every process, collapsing the process explorer.**
10. **P1 — `InterviewClient.tsx` (~1555 lines) plus unused semantic-VAD fields, unused v1 prompt, and missing Prisma migrations make the system hard to operate safely.**

## Confirmed production bugs

These are confirmed from code, not inferred from filenames.

| ID | Bug | Why it is a bug, not a style issue |
| --- | --- | --- |
| B1 | Speech shorter than 350ms is cleared from the Realtime input buffer | `handleUserSpeechStopped` calls `input_audio_buffer.clear` when `elapsed < BARGE_IN_MIN_MS`. Short real answers disappear before transcription. |
| B2 | RMS noise gate starts closed (`gain = 0`) and opens only above 0.02 RMS | Quiet speech, Bluetooth mics, and word onsets can be clipped before they reach OpenAI. |
| B3 | `rememberPersistEventId` skips later history POSTs for the same item | Streaming transcript completions never update the DB until a clean complete flush. Refresh/crash can lose the final text. |
| B4 | Transcription config sends `language: "hy"` for `gpt-live-transcribe` | Current official docs: this model uses `languages`, not `language`. Russian/English interviews still transcribe as Armenian. |
| B5 | No Russian opening path | `openingResponseInstructions` has English and Eastern Armenian only. `language=ru` still opens in Armenian. |
| B6 | UI always shows `հայերեն` | `InterviewClient` hard-codes the language label regardless of `interview.language`. |
| B7 | Text mode stores user rows only | `action === "text"` creates a user message and returns. No Responses API call. |
| B8 | Reconnects.current only increments | Three disconnects over a 20-minute call force text mode even if reconnects succeeded. |
| B9 | MCP has no ingest key | REST `/api/invitations` requires `INGEST_API_KEY`; `/api/mcp` does not. |
| B10 | `clusterTag: parsed.crossInterviewTags[0] ?? process.name` | All processes in an interview share the first global tag. |
| B11 | Reanalysis orphans `InterviewAnalysis` rows and deletes processes | Old analyses accumulate; process/opportunity rows are wiped, including any human-facing process data. |
| B12 | Dashboard “strong opportunity” / “pilot-ready” counts only the latest 8 interviews | Funnel cards use full counts; those two stats do not. |
| B13 | `planTranscriptUpsert` matches by array index, not `item_id` | Official docs: transcription completion events may arrive out of order and must be matched by `item_id`. |
| B14 | Production deploy workflow runs `git commit --amend --reset-author` | Deployed artifact is not the GitHub commit SHA. |
| B15 | CI does not run `npm test` or eslint | Lint currently fails; tests would not gate merge. |

## First implementation phase recommended

**Phase 0 (baseline) then Phase 1 (audio and short answers).**

Do not rewrite the interviewer prompt, analyzer schema, or dashboard until:

- the custom mic gate is feature-flagged off by default;
- duration-based `input_audio_buffer.clear` is removed;
- persist identity uses `providerItemId` and allows final-text updates;
- a gold-set recording plan exists so Armenian reviewers can measure clipped-answer rate.

Phase 2 (multilingual transcription: `languages`, keywords, Russian opening) should follow immediately because it is a configuration change with high speech-quality impact.

## Files created

```text
Docs/ai-audit/00_EXECUTIVE_SUMMARY.md
Docs/ai-audit/01_CURRENT_ARCHITECTURE.md
Docs/ai-audit/02_INTERVIEW_LIFECYCLE.md
Docs/ai-audit/03_AUDIO_AND_REALTIME_AUDIT.md
Docs/ai-audit/04_ARMENIAN_LANGUAGE_AUDIT.md
Docs/ai-audit/05_TRANSCRIPT_RELIABILITY_AUDIT.md
Docs/ai-audit/06_ANALYZER_AND_DATA_AUDIT.md
Docs/ai-audit/07_SECURITY_AND_PRODUCTION_AUDIT.md
Docs/ai-audit/08_REDUNDANT_CODE_AND_CLEANUP.md
Docs/ai-audit/09_IMPLEMENTATION_TODO.md
Docs/ai-audit/10_TEST_AND_EVALUATION_PLAN.md
```

## Commands run and results

| Command | Result |
| --- | --- |
| `npm test` | **22 passed, 0 failed** (73ms). First sandbox run failed with `tsx` IPC `EPERM`; rerun outside sandbox succeeded. That first failure is environmental. |
| `npx eslint src` | **4 errors, 2 warnings.** Errors: `VoiceOrb.tsx` updates refs during render (`react-hooks/refs`). Warnings: unused `Link` in companies page; `window.location.href` in admin sidebar. |
| `npm run build` | **Succeeded.** Prisma 7 deprecation warning for `package.json#prisma`. Next.js 16 deprecation: `middleware.ts` should become `proxy.ts`. TypeScript passed. |
| Local Next.js docs | Read `node_modules/next/dist/docs/index.md` and `01-app/01-getting-started/16-proxy.md`. |

`npm test` globs `src/lib/openai/*.test.ts`, which currently has **no files**. The glob still ran because interview tests exist.

## Decisions required from the project owner

1. **Microphone gate:** disable by default, or delete? Recommendation: feature-flag off by default, then delete after eval.
2. **Native Realtime barge-in:** set `interrupt_response: true` and remove the 350ms client timer, or keep custom barge-in behind a flag?
3. **MCP authentication:** ChatGPT plugin currently documents auth as None. Accept API-key/OAuth, IP allowlist, or a signed ChatGPT connector secret?
4. **Analysis trigger:** keep admin-manual only, or auto-analyze on complete?
5. **Voice:** stay on `sage`, or benchmark `marin` / `cedar` (OpenAI currently recommends those for best quality)?
6. **Text interviews:** implement a full Responses API fallback, or keep voice-only until the first 20 interviews?
7. **Prisma migrations:** introduce `prisma migrate` for production, or continue `db push` + manual SQL?
8. **Deploy provenance:** stop amending commits in GitHub Actions even if Vercel Hobby author matching remains painful?
9. **Public assessment:** keep `/assessment` open, or disable until ingest is authenticated and rate-limited in Redis?
10. **Native-name fields:** add `firstNameHy` / `companyNameHy` now, or wait for prompt Phase 4?

## Items requiring native Eastern Armenian human review

- Live pronunciation of Yerevan professional speech for `sage` vs `marin` vs `cedar`.
- Whether the v2 prompt still sounds translated/bookish in real conversations.
- Short-answer capture: `հա`, `այո`, `ոչ`, `լավ`, Armenian numbers.
- Code-switching with Russian and English business terms (1C, ArmSoft, Excel, ERP, CRM, SKU).
- False-clarification rate of transcript-quality heuristics on real mixed-language speech.
- Opening greeting using Latin-spelled Armenian names vs Armenian script names.
- Gold-set recordings in `src/eval/armenian-utterances.md` (exists as a checklist, not yet a scored dataset).

Do not implement application changes until the project owner reviews and approves `09_IMPLEMENTATION_TODO.md`.
