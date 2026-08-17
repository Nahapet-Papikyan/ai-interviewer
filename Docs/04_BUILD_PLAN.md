# Build Plan --- From Empty Repo to First Real Interview

## Phase 0 --- Decisions (half day)

-   [ ] Pick project name.
-   [ ] Create private Git repository.
-   [ ] Create OpenAI API Platform project.
-   [ ] Create project-scoped API key.
-   [ ] Add billing/usage limits.
-   [ ] Create Postgres database.
-   [ ] Decide ORM.
-   [ ] Decide whether authentication is simple single-admin for MVP.
-   [ ] Decide raw-audio policy: recommended `do not store`.

## Phase 1 --- Data/Admin (Day 1)

-   [ ] Create DB schema: companies, contacts, interviews, messages.
-   [ ] Seed 3 fake companies and contacts.
-   [ ] Admin company list.
-   [ ] Contact list.
-   [ ] Create invitation.
-   [ ] Generate cryptographically random public token.
-   [ ] Store only token hash if practical.
-   [ ] `/i/[token]` resolves invitation.
-   [ ] Status transitions OPENED/STARTED/etc.

Definition of done: A fake contact can open a unique interview page
without email in URL.

## Phase 2 --- Voice spike (Day 2)

-   [ ] Install `@openai/agents` and `zod`.
-   [ ] Implement `/api/realtime/token`.
-   [ ] Mint ephemeral client secret server-side.
-   [ ] Create `RealtimeAgent`.
-   [ ] Create `RealtimeSession`.
-   [ ] Connect browser via WebRTC.
-   [ ] Microphone permission.
-   [ ] Start/stop/mute UI.
-   [ ] semantic VAD.
-   [ ] interruption handling.
-   [ ] render live transcript/history for debugging.
-   [ ] Armenian smoke test.

Definition of done: You can speak Armenian for 10 minutes and naturally
interrupt the agent.

## Phase 3 --- Interview intelligence (Days 3--4)

-   [ ] Integrate `02_INTERVIEWER_SYSTEM_PROMPT.md`.
-   [ ] Inject company/contact context.
-   [ ] Add `record_process_candidate`.
-   [ ] Add `record_key_fact`.
-   [ ] Persist conversation turns.
-   [ ] Implement reconnect/resume behavior.
-   [ ] Add text fallback.
-   [ ] Add explicit interview consent screen.
-   [ ] Test 10 scripted personas.

Personas: 1. distributor with 2,000 orders/month; 2. already automated
distributor; 3. small company with no meaningful volume; 4. CFO focused
on AP; 5. CEO who knows few details; 6. operations manager with detailed
numbers; 7. impatient respondent; 8. Armenian/Russian code-switcher; 9.
respondent with contradictory numbers; 10. respondent who asks what data
you know about company.

Definition of done: Agent does not follow a fixed questionnaire and
discovers the correct high-value process in at least 8/10 scripted
scenarios.

## Phase 4 --- Analyzer (Day 5)

-   [ ] Save immutable ordered transcript.
-   [ ] Implement Structured Output schema.
-   [ ] Run analyzer after completion.
-   [ ] Store raw analysis JSON.
-   [ ] Materialize processes/evidence/opportunities.
-   [ ] Implement deterministic metric calculations.
-   [ ] Add retries/idempotency.
-   [ ] Show evidence next to extracted values.

Definition of done: No critical numeric field appears in dashboard
without transcript evidence or explicit derived assumptions.

## Phase 5 --- Dashboard (Days 6--7)

-   [ ] Overview metrics.
-   [ ] Interview table.
-   [ ] Interview detail.
-   [ ] Transcript viewer.
-   [ ] Process cards.
-   [ ] Evidence viewer.
-   [ ] Score breakdown.
-   [ ] Filters.
-   [ ] Cross-company Process Explorer.
-   [ ] CSV export.

Do not spend time on elaborate visual design yet.

## Phase 6 --- Armenian evaluation (Day 8)

Create 30--50 short test utterances and 5 complete mock interviews.

Include: - Armenian numbers; - դրամ/AMD/USD; - 1C; - Excel; -
invoices/orders/SKU; - company names; - mixed Russian/English terms; -
noisy audio; - long pauses.

Run A/B: - `gpt-realtime-2.1` - `gpt-realtime-2.1-mini`

Score 1--5: - comprehension; - factual capture; - natural Armenian; -
latency; - interruption; - code switching.

Choose based on observed quality, not price alone.

## Phase 7 --- Internal pilot (Days 9--10)

-   [ ] 10 interviews with yourself/colleagues playing personas.
-   [ ] 3 real friendly business contacts.
-   [ ] review every transcript manually.
-   [ ] compare AI extraction to human extraction.
-   [ ] fix interviewer prompt.
-   [ ] fix analyzer prompt.
-   [ ] version prompts.

Only after this send cold outreach.

## Phase 8 --- Outreach V1

First batch: 10--20 carefully selected contacts.

Do email sending manually or semi-manually initially.

Reason: if response is zero, you need to know whether the problem is
messaging, deliverability, target quality, trust, or the interview
itself. Full email automation too early makes diagnosis harder.

Track:

``` text
invited
opened interview page
consented
started
5+ min
completed
report requested
pilot interested
human follow-up requested
```

Then scale to 50--100 qualified contacts.

## Security checklist

-   [ ] OpenAI permanent API key server-only.
-   [ ] Ephemeral token created just-in-time.
-   [ ] Public interview token high entropy.
-   [ ] Rate limit token endpoint.
-   [ ] Prevent token enumeration.
-   [ ] No respondent email in URL.
-   [ ] Sanitize admin-rendered transcript.
-   [ ] DB backups.
-   [ ] Log redaction.
-   [ ] No raw secrets in analytics.
-   [ ] Do not store raw audio unless explicitly needed/consented.
-   [ ] Ability to delete interview data.
-   [ ] Prompt injection cannot access admin secrets/tools.
-   [ ] Browser tools call server for privileged operations.

## Observability

Log: - connection failures; - session duration; - interruption count; -
reconnect count; - tool errors; - analyzer failures; - token/model
usage; - latency; - completion funnel.

Keep `prompt_version`, `model`, and `schema_version` on every
interview/analysis so results remain reproducible.

## API cost control

Realtime audio is materially more expensive than text. Use the
high-quality realtime model during validation, measure actual
per-interview cost, then A/B the mini model.

Set project usage limits and alerts before cold outreach.

Post-interview analysis is text-only and comparatively cheap; optimize
it only after quality is proven.

## Do not build yet

Avoid: - RAG/vector DB; - multi-agent handoff maze; - fine-tuning; -
telephony; - automatic LinkedIn scraping; - complex email sequencing; -
polished PDF reports; - CRM; - multi-tenancy.

Every feature must answer: "Will this help us get or correctly interpret
the first 20--30 interviews?"

If no, defer it.

## API key setup

1.  Open OpenAI API Platform.
2.  Create a dedicated project for this MVP.
3.  Add billing.
4.  Project Settings → API Keys → Create new secret key.
5.  Prefer restricted permissions appropriate to the endpoints used.
6.  Copy once and store in `.env.local`/deployment secret manager.
7.  Never commit it.
8.  Backend uses it to mint Realtime ephemeral tokens and call Responses
    API.

Official references: -
https://help.openai.com/en/articles/9186755-managing-projects-in-the-api-platform -
https://help.openai.com/en/articles/4936850-where-do-i-find-my-secret-api-key -
https://openai.github.io/openai-agents-js/guides/voice-agents/quickstart/
