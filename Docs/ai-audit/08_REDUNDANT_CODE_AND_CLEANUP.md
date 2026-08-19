# Redundant code and cleanup

Rules: deletions below are proven with repository search of `src/**/*.ts` and `src/**/*.tsx` unless noted.

## Oversized files

| File | Lines | Responsibility |
| --- | --- | --- |
| `src/components/interview/InterviewClient.tsx` | 1555 | UI + WebRTC + tools + persist + reconnect + text |
| `src/prompts/interviewer.system.v2.md` | 866 | spoken agent manual |
| `src/app/api/interviews/session/route.ts` | 323 | all interview mutations |
| `src/lib/openai/analyzer.ts` | 312 | analysis + persistence |

Target split for `InterviewClient` (Phase 5, after state reducer):

- `useInterviewConnection.ts`
- `useInterviewTranscript.ts`
- `interview-tools.ts`
- `InterviewConsent.tsx` / `InterviewLive.tsx` / `InterviewEnded.tsx`

## Duplicate configuration

Realtime audio config is copied in `realtime.ts`, `InterviewClient` session construct, and `setVadAutoResponse`. See `03_AUDIO_AND_REALTIME_AUDIT.md`.

Analyzer schema exists in `src/lib/openai/schemas.ts`, embedded in `src/prompts/analyzer.system.md`, and again in `Docs/03_ANALYZER_SYSTEM_PROMPT_AND_SCHEMA.md`.

## Duplicate / outdated prompts and docs

| Artifact | Proof unused as runtime | Recommendation |
| --- | --- | --- |
| `src/prompts/interviewer.system.md` | no `src` imports; loader reads only `interviewer.system.v2.md` | move to `Docs/archive/` after v3 ships, not before rollback is possible |
| `Docs/02_INTERVIEWER_SYSTEM_PROMPT.md` | differs from v2 | mark stale; point to `src/prompts` |
| `Docs/03_*.md` | differs from `analyzer.system.md` | generate from source or delete later |
| `Docs/00_README.md` repo tree | lists `interviews/[id]/events` and `complete` routes that do not exist | update in Phase 8 |
| `Docs/04_BUILD_PLAN.md` | checkboxes still empty though features exist | archive or retitle as original plan |

## Deprecated / unused exports (search-proven)

| Symbol | Search result | Action |
| --- | --- | --- |
| `OPENING_RESPONSE_INSTRUCTIONS` | defined in `client-session.ts` 119–120 only | delete after tests use `openingResponseInstructions()` only (they already do) |
| `action === "abandon"` | only `session/route.ts` 284–287; no client caller | keep server handler for future; or wire `beforeunload` — do not delete until product decides auto-abandon |
| `VOICE_TURN_CONFIG.prefixPaddingMs/silenceDurationMs/threshold` | computed, never sent | delete keys |
| `Process.painScore` | schema only, no `src` writes | keep column; stop exposing if UI never shows it (admin may still select it via prisma include — unused) |
| `userSaidYes`, `extractLaborSignals`, `looksLikeUnconfirmedNumberGuess` | only `facts.ts` definitions; `confirmedUserFactFromExchange` used in tests only | keep for Phase 5/6 or use them in production fact confirmation; do not delete until confirmation flow is real |
| `RerunAnalysis` | alias of `AnalyzeInterviewButton` in InterviewControls | optional rename |

## Unused components / imports

| Item | Proof | Action |
| --- | --- | --- |
| `Link` in `src/app/(admin)/companies/page.tsx` | eslint `@typescript-eslint/no-unused-vars` | remove import |
| `src/lib/openai/*.test.ts` glob | directory has no test files | add tests or drop glob |

Landing and `components/ui/*` are used by marketing/admin. No unused page components were proven; do not delete UI primitives by suspicion.

## Empty catch blocks

Many `catch { // already closed }` around Realtime transport. Acceptable if logged at debug. `persistHistory(...).catch(() => undefined)` **swallows persistence failure** — log `HISTORY_PERSIST_FAILED`.

Seed `prisma/seed.ts` duplicates `hashToken` instead of importing `src/lib/tokens.ts` (fine for seed isolation).

## Unsafe casts

`as unknown[]` for SDK history; `as MessageRole`; Prisma JSON casts. No `as any` in `src/`. Prefer small type guards in the transcript extractor (Phase 3).

## Misleading comments / stale checklists

- `Docs/01` recommends `interruptResponse: true` and text fallback; code does the opposite for interrupt and incomplete for text.
- `Docs/01` semantic VAD eagerness `medium`; code uses `low`.
- Build plan Phase boxes remain `[ ]` despite implemented work.

## Next.js deprecations

- `middleware.ts` → `proxy.ts` (Next.js 16 local docs). Codemod: `npx @next/codemod@canary middleware-to-proxy .` in Phase 8.
- Prisma `package.json#prisma` seed key deprecated for Prisma 7.

## ESLint (read-only run)

Errors (must fix in Phase 0/8, not now):

- `VoiceOrb.tsx` 51–54: ref updates during render (`react-hooks/refs`).

Warnings:

- unused `Link` on companies page;
- `window.location.href` in `Sidebar.tsx` (Next rule: use `useRouter`).

## Temporary discarded variables

`analyzer.ts` `void created; void analysis;` after create — leftover. Remove in analyzer cleanup.

## InterviewClient refs

Dozens of refs are necessary for event handlers. After a reducer, most boolean refs collapse. Do not delete individually now.

## Feature flags (recommended, not present)

None exist today. Phase 0 should add a small `src/lib/flags.ts` reading env:

- `FEATURE_MIC_PROCESSING` (default false)
- `FEATURE_NATIVE_INTERRUPT`
- `FEATURE_TEXT_AGENT`
- `FEATURE_AUTO_ANALYSIS`

Rollback = unset env + redeploy. No code deletion until flags bake.
