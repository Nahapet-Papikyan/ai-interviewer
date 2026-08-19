# Analyzer and database audit

## Analyzer pipeline

Trigger: admin `POST /api/analysis` (`src/app/api/analysis/route.ts`) always `{ force: true }`. Completing a voice interview does **not** start analysis (`shouldStartAnalysis` returns false unless `force`).

Lock: `updateMany` sets status `ANALYZING` for a wide set of statuses when forced. Concurrent double-click: second request may no-op if count is 0, unless status is already `ANALYZING` (then it proceeds anyway — **two analyses can run**).

Prompt: `src/prompts/analyzer.system.md` via `getAnalyzerPrompt()`. Version `analyzer-v1`. Schema version `analysis-schema-v1`.

Model: `OPENAI_ANALYSIS_MODEL` or `gpt-5.6-terra`. API: `client.responses.parse` + `zodTextFormat(InterviewAnalysisSchema)`.

Inputs: company facts/hypotheses, respondent name/role, provisional `InterviewFact`s, numbered transcript `[sequenceNo] ROLE: text`.

Persistence transaction (60s):

1. `process.deleteMany({ interviewId })` — cascades steps, systems, evidence, opportunity.
2. `interviewAnalysis.create` — **previous analysis rows kept**.
3. Create processes with derived monthly volume / hours / FTE.
4. Interview → `ANALYZED`.

On catch: interview → `FAILED` + `analysis_failed` event. That is a harsh status: a research interview that failed analysis looks like a failed interview.

`void created; void analysis;` discards locals after create (no bug, leftover).

### Evidence

`ProcessEvidence.messageId` is `messagesBySeq.get(ev.messageSequence)?.id ?? null`. Missing sequences become null; they are **not rejected**. Excerpt is **not** checked against `contentText`. Assistant-sourced EXPLICIT is downgraded to INFERRED. User confirmation of an assistant paraphrase is allowed by prompt rule 15 but not enforced in code beyond role checks.

Volume reliability: if no related evidence rows, `basis === "EXPLICIT"` still counts as reliable (`volumeIsReliable`). That lets uncited numbers through derivation.

Labor reliability requires at least one related evidence row.

`isReliableNumericSource` rejects assistant role, non-CONFIRMED, INFERRED/DERIVED, confidence &lt; 0.75.

### FTE and scoring

`deriveMonthlyTransactions` / `deriveLabor` (`metrics.ts`): 22 working days, 4.33 weeks, `FTE_HOURS_PER_MONTH` (default 176). Unreliable or `laborLooksContradictory` (implied weekly hours vs `people*40` off by ≥3×) → null FTE. Model `labor.fteMin/Max` ignored (good). People-involved is not converted to FTE by itself (good).

Component scores come from the model; **total is recomputed** (`totalFromBreakdown`). Model `scoring.total` ignored (good). Components themselves are not deterministically derived from volume/hours — two runs can differ.

`Opportunity.pilotReadiness` is set from **interview-level** `parsed.pilot.willingness`, copied onto every process.

### Taxonomy

```ts
clusterTag: parsed.crossInterviewTags[0] ?? process.name
```

Every process shares the first global tag. Process explorer (`(admin)/processes/page.tsx`) groups on `clusterTag`. Prompt says each process should be tagged; code discards per-process tags (schema has no per-process tag field, only interview-level `crossInterviewTags`).

### Human review

`markReviewed` writes `reviewNotes` and status `REVIEWED`. Re-analyze with force deletes processes and writes a new analysis row. Review notes remain on the interview, but process-level human corrections **do not exist as a layer** — there is nothing to preserve except notes. Status `REVIEWED` is included in the force claim set, so review can be overwritten by a new machine snapshot.

JSON-only fields: follow-up questions, interview summary quality, limitations, per-process `missingCriticalData`, automation `humanInLoop` live in `InterviewAnalysis.rawJson` and selected UI fields. CSV export does not include evidence or assumptions.

---

### [P1] All processes receive the first global cluster tag

Status: Confirmed bug

Evidence:
- File: `src/lib/openai/analyzer.ts` line 237
- Function or lines: `runInterviewAnalysis` process create
- Current behavior: `clusterTag: parsed.crossInterviewTags[0] ?? process.name`

Why it matters:
- User impact: Process Explorer merges unrelated workflows.
- Data impact: cross-company repeatability cannot be measured.
- Production impact: the strategic screen in Docs/01 is wrong.

Recommended change:
1. Add optional `taxonomyTag` on each process in the Zod schema.
2. Map `process.taxonomyTag ?? slug(process.name)`.
3. Keep `crossInterviewTags` as interview-level extras only.

Acceptance criteria:
- [ ] Two processes in one interview can have different `clusterTag`s.
- [ ] Fixture test with two tags.

Dependencies: schema tweak. Risk: Low. Size: S

### [P1] Evidence excerpts and sequences are not validated

Status: High-risk design

Evidence:
- File: `analyzer.ts` 254–265
- Current behavior: unknown `messageSequence` → `messageId: null`; excerpt stored as-is.

Why it matters:
- User impact: dashboard can show a number “from turn 12” that turn 12 does not contain.
- Data impact: fabricated or drifted numbers look evidenced.
- Production impact: quality gate “100% no fabricated numeric values” cannot be enforced.

Recommended change:
1. If EXPLICIT, require user message id and `excerpt` substring (normalized whitespace) of that message.
2. Else downgrade to INFERRED or drop the numeric field.
3. Reject derivation when volume evidence fails.

Acceptance criteria:
- [ ] EXPLICIT evidence without a matching user excerpt is not stored as EXPLICIT.
- [ ] Analyzer tests with mismatched excerpt.

Dependencies: none. Risk: Medium (more nulls). Size: M

### [P1] Reanalysis is not a versioned overlay

Status: High-risk design

Evidence: `process.deleteMany` + `interviewAnalysis.create` without deleting or superseding pointer; UI `analyses take: 1`.

Recommended change:

```text
InterviewAnalysis
  version Int
  status MACHINE | SUPERSEDED | REJECTED
  rawJson
  createdAt
Interview.currentAnalysisId
HumanReview overlay (optional JSON / tables) never deleted by machine rerun
```

Force reanalysis inserts version n+1, points current to it, **does not** delete human overlay. Processes materialization can rebuild from the new JSON into a side table or replace only `source=MACHINE` rows.

Acceptance criteria:
- [ ] Previous `rawJson` remains queryable.
- [ ] REVIEWED notes survive.
- [ ] Concurrent POST cannot create two ANALYZING workers (compare-and-set + advisory lock).

Dependencies: migration. Risk: Medium. Size: L

### [P2] Analysis is not started on interview complete

Status: Improvement

Evidence: `shouldStartAnalysis` / complete handler.

For the 20–30 interview milestone, manual analyze is easy to forget. Auto-run with lock after complete, plus admin re-run, is the intended Docs/01 pipeline.

Risk: cost. Size: S once locking is fixed.

---

## Database design

Source: `prisma/schema.prisma`. No `prisma/migrations` directory. Production likely uses `db push` plus `prisma/manual/2026-08-18-interview-reliability.sql`.

### Models

| Model | Keys / indexes | Notes |
| --- | --- | --- |
| Company | id | `verifiedFacts` / `hypotheses` JSON arrays |
| Contact | id; FK company cascade | no unique (companyId, email) |
| Interview | unique `publicTokenHash` | `state` JSON; versions as strings |
| InterviewMessage | unique (interviewId, sequenceNo); index (interviewId, providerEventId) | providerEventId **not unique** |
| InterviewEvent | none besides id | unbounded log |
| InterviewFact | none besides id | duplicates possible except app-level findFirst |
| Process | none besides id | `painScore` unused; `clusterTag` unindexed |
| ProcessStep / ProcessSystem | none | |
| ProcessEvidence | message relation **no onDelete** (Restrict) | |
| InterviewAnalysis | none | many per interview |
| Opportunity | unique processId | |

### Missing indexes (hot paths)

`Interview.companyId`, `contactId`, `status`, `createdAt`; `Process.interviewId`, `clusterTag`; `InterviewFact.interviewId`; `InterviewEvent.interviewId`; `InterviewAnalysis.interviewId`; `Contact.companyId`.

### Missing uniqueness

- `(interviewId, providerEventId)` where not null.
- `(companyId, lower(email))` for contacts.
- Company name uniqueness is **not** recommended as a hard unique (legal entities can share names); use a find-or-create transaction with retry instead.

### Denormalized / JSON

Keep JSON: `verifiedFacts`, `hypotheses`, `Interview.state`, `event.payload`, `analysis.rawJson`, `scoreBreakdown`, integration/risks/pilot JSON.

Normalize later: taxonomy tags, systems (already a table), fact categories (string today).

### Enums that should exist

`Interview.language` (`hy|en|ru`), `pilotReadiness`, `Process.clusterTag` taxonomy, `InterviewFact.category`. Today they are free strings.

### Cascade risks

Deleting a company deletes contacts, interviews, messages, analyses. Admin `deleteInterview` cascades processes. ProcessEvidence → Message is Restrict: deleting a single message while evidence points at it will throw. Reanalysis deletes processes first, so it usually succeeds.

### Unused field

`Process.painScore`: no writes in `src/`. Keep nullable; do not delete until after a migration review.

### Duplicate company/contact

`invite.ts` `findFirst` by name is racy under concurrent MCP/REST. Assessment **always** creates a new company, so the same person submitting twice creates duplicates.

### Safe migrations (do not apply now)

1. Add nullable transcript columns (`partialText`, `finalText`, `status`, `completedAt`, `previousItemId`).
2. Backfill `finalText = contentText`.
3. Create unique index on `(interviewId, providerEventId)` using a partial unique index `WHERE "providerEventId" IS NOT NULL`.
4. Add `Interview.currentAnalysisId`, `InterviewAnalysis.version`.
5. Add Contact `firstNameHy`, Company `nameHy` (nullable).
6. Add indexes listed above.
7. Introduce `prisma/migrations` from the current schema as baseline (`prisma migrate diff` from empty) **after** a production snapshot.

Prisma 6.19 warns that `package.json#prisma` seed config is deprecated in Prisma 7 — plan `prisma.config.ts` in Phase 8, not during transcript work.
