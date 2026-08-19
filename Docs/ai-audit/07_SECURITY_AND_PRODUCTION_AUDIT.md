# Security and production audit

## Admin authentication

| Piece | Implementation |
| --- | --- |
| Password | `ADMIN_PASSWORD` compared in `checkAdminPassword` |
| Session | HMAC-SHA256 `admin.<expiresMs>.<hex>` using `AUTH_SECRET` |
| Cookie | `ai_admin`, httpOnly, sameSite=lax, secure in production, 7-day maxAge, path `/` |
| HTML gate | `src/middleware.ts` matcher for `/dashboard|/companies|/contacts|/interviews|/processes` |
| API gate | each admin route calls `isAdmin()` / `requireAdmin()` |

Next.js 16 docs (`node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`): middleware is renamed **proxy**; proxy is an optimistic check, not a complete authorization solution. API routes correctly re-check the cookie. Admin layout does **not** re-check (relies on middleware). That is acceptable if proxy keeps running; a leftover ignored `middleware.ts` after a future rename would expose HTML admin pages.

Build warning: `The "middleware" file convention is deprecated. Please use "proxy" instead.` Functionality still ran (build listed `ƒ Proxy (Middleware)`).

Login: `POST /api/admin/login` has **no rate limit** and **no lockout**. `safeEqual` returns immediately on length mismatch, leaking password length via timing. Cookie HMAC compare also uses `safeEqual` on hex signatures of equal expected length (better).

`ingest-auth.ts` uses `!==` string compare for `INGEST_API_KEY` (timing leak of key bytes; lower severity than login if the key is high entropy).

## Public invitation tokens

Entropy: 24 bytes (~192 bits) base64url. Stored hashed. Token in the URL path is the capability. Anyone with the link can:

- mint Realtime secrets (10/min/IP, in-memory);
- POST arbitrary `runtime` / `history` / `fact` / `complete`;
- read **full interviewer instructions** including hypotheses (`token/route.ts` 127–129).

Session endpoint has **no rate limit**. History arrays are unbounded except Next body limits.

## MCP and REST ingest

REST `/api/invitations` requires `INGEST_API_KEY` (503 if unset). CORS `*` on OPTIONS only.

MCP `/api/mcp`: CORS `*`, no API key, ChatGPT docs say Authentication **None**. `createInterviewInvitation` writes Company/Contact/Interview and returns a live URL. Rate limit: 40/hour **global key** `mcp:createInterviewInvitation` in process memory.

Unauthenticated callers can poison `hypotheses` / `verifiedFacts` that the interviewer may mention, and burn OpenAI budget when victims open links.

## Assessment

`POST /api/assessment/start` is public. 6/hour per `x-forwarded-for` (spoofable if the platform does not overwrite that header). Always creates new companies. Language `hy|en` only.

## Rate limiting

`src/lib/rate-limit.ts`: in-memory `Map`. Ineffective across Vercel instances and after cold start. Used on MCP, invitations, assessment, realtime token, trace. **Not** on login or session.

Maps that grow without eviction: rate-limit buckets, `transcriptLocks`, client `openingTriggered` / `persistEventIds` / `connections`. Serverless instances die, but a long-lived Node process (or busy instance) retains keys forever.

## Prompt and research privacy

Token JSON includes `instructions` (full v2 prompt + company hypotheses). Interview token holders — including anyone who received a leaked link — see internal research notes. Logging scrubs `instructions` / `transcript` keys in `interviewLog`, which is good. Client still received the prompt.

## Error responses

- Analysis: `error.message` to admin (OpenAI/DB text).
- Invitations: Prisma/message to caller.
- MCP: exception message in tool content.
- Realtime mint failure: message sliced to 400 chars thrown, then token route may 500 with that text if uncaught — actually `mintRealtimeClientSecret` throw is not caught in the token route, so Next may return a 500. Confirm: no try/catch around mint in token route → unhandled, generic or message depending on Next error overlay. In production, avoid leaking mint body errors.

## APP_URL / invitation URLs

`interviewPublicBaseUrl` (`invitation-api.ts` 61–68):

1. `APP_URL` if set and not localhost;
2. else `requestOrigin` if not localhost;
3. else `APP_URL` even if localhost;
4. else `SITE_URL` (`https://bussnes-research.am`).

MCP passes `request.nextUrl.origin`. On Vercel previews this can mint `*.vercel.app` links. If a caller forges `Origin`/`Host` depending on platform trust, invitation URLs can point at an attacker host that still uses a valid token path only if the victim later opens the real site — actually the token is in the returned URL; a phishing page could collect it. Prefer **only** configured `APP_URL` in production; never request origin.

`.env.example` does not list `INGEST_API_KEY`.

## CORS

MCP `Access-Control-Allow-Origin: *` with methods GET, POST, DELETE. Browser sites can call the tool from anywhere.

## Logging

`logging.ts` redacts a fixed key set. `previewText` still sends short STT snippets to server traces in non-prod. Production client traces are disabled (`NODE_ENV === "production"`). Server `console.info("[interview]", payload)` still runs in production with interview ids and phases.

## Production URL construction

Admin invitation redirect: `/interviews/{id}?token={plaintext}` — token in Referer/logs if the operator clicks outbound links. Acceptable for MVP if they copy quickly; better as a flash once on the page without query persistence.

---

### [P0] MCP invitation tool is unauthenticated

Status: Confirmed bug / High-risk design (documented as intentional)

Evidence:
- File: `src/app/api/mcp/route.ts`, `src/lib/mcp/server.ts`, `Docs/05_INVITE_API.md`
- Function or lines: CORS `*`; `handleCall` has no `requireIngestApiKey`
- Current behavior: any JSON-RPC `tools/call` can create DB rows and URLs, limited only by an in-process 40/hour counter.

Why it matters:
- User impact: fake interview links, prompt injection via hypotheses.
- Data impact: poisoned companies/contacts.
- Production impact: OpenAI spend, untrusted research corpus.

Recommended change:
1. Require `INGEST_API_KEY` or MCP OAuth as ChatGPT custom connector auth.
2. If ChatGPT cannot send secrets, put MCP behind Cloudflare Access / IP allowlist / signed tunnel, and stop advertising Auth: None.
3. Distributed rate limit per caller.
4. Cap `hypotheses`/`notes` length (already 2000 on notes; arrays unbounded count except Zod default).

Acceptance criteria:
- [ ] Unauthenticated `tools/call` returns 401.
- [ ] REST and MCP share the same auth helper.
- [ ] Docs updated.

Dependencies: ChatGPT connector auth capability or network allowlist.

Risk: High (breaks current ChatGPT plugin until reconfigured).

Estimated size: S

### [P0] Full interviewer prompt and hypotheses returned to the browser

Status: Confirmed bug

Evidence:
- File: `src/app/api/realtime/token/route.ts` 127–129
- Function or lines: `NextResponse.json({ clientSecret, instructions, ... })`
- Current behavior: client uses `data.instructions` as `RealtimeAgent.instructions` and may `session.update` them again.

Why it matters:
- User impact: respondent (or anyone with the link) can read research hypotheses.
- Data impact: prompt-injection surface (“ignore hypotheses”) is visible.
- Production impact: violates Docs/01 “hypotheses must not be presented as fact” if the respondent simply reads the JSON.

Recommended change:
1. Mint instructions **only** in `client_secrets` session config (already sent in `realtime.ts`).
2. Agent constructor can use a short public instruction; server session already has the full prompt if mint included it.
3. Return only safe UI metadata (first name, company, language, continuation, recentTurns).

Verify Agents SDK: mint session instructions vs client `RealtimeAgent.instructions` overwrite. If the SDK’s `session.update` on connect overwrites mint with the shorter client instructions, keep sending instructions from the client **but strip hypotheses** from the browser copy and keep hypotheses server-side only if using a server transport. For WebRTC, the practical fix is: send full instructions in mint **and** in the client agent (needed for SDK sync) while **removing hypotheses from any client-visible JSON** and from anything the model is allowed to quote — still visible in DevTools if the client agent needs them.

Honest constraint: browser Realtime **must** receive instructions to speak. Hypotheses therefore should be:

- omitted from the prompt’s client copy; or
- replaced with “probe operations generally” without named guesses.

Do not return `instructions` as a dedicated JSON field if the SDK already got them via mint; confirm with a session.created dump in a staging call.

Acceptance criteria:
- [ ] Network tab of `/api/realtime/token` has no `hypotheses` text.
- [ ] Agent still follows Eastern Armenian opening.

Dependencies: one staging Realtime session to confirm overwrite rules.

Risk: Medium. Size: S

### [P1] Admin login can be brute-forced; password length is observable

Status: High-risk design

Evidence: `api/admin/login/route.ts`; `auth-token.ts` `safeEqual` 15–21.

Recommended change: hash compare of SHA-256(password) after padding both to equal length; distributed rate limit (5/15min/IP); optional delay; consider passkeys later.

Acceptance criteria:
- [ ] 20 rapid logins from one IP return 429.
- [ ] Equal-time compare regardless of password length.

Dependencies: Redis or Upstash (or Vercel KV). Risk: Low. Size: S

### [P1] In-memory rate limits do not work on Vercel

Status: High-risk design

Evidence: `src/lib/rate-limit.ts`; multiple instances.

Recommended change: Upstash Redis REST or Vercel KV sliding window. Same helper for login, token, session, MCP, assessment.

Acceptance criteria:
- [ ] Two instances share the counter (integration test or staging check).

Dependencies: Redis credentials. Risk: Low. Size: M

### [P1] Invitation URL may use request origin

Status: High-risk design

Evidence: `interviewPublicBaseUrl` in `invitation-api.ts`.

Recommended change: in `NODE_ENV=production`, require `APP_URL`; ignore origin.

Acceptance criteria:
- [ ] Production invite links always use `APP_URL`.
- [ ] Missing `APP_URL` fails closed (500), not `SITE_URL` surprise.

Dependencies: Vercel env. Risk: Low. Size: XS

### [P1] Session API accepts unbounded history and arbitrary runtime from token holders

Status: High-risk design

Evidence: `session/route.ts` `action=runtime|history` with no size cap or schema besides role/content.

Recommended change: Zod max turns (e.g. 200), max content length (e.g. 8k/turn), runtime patch allowlist, rate limit per interview id.

Acceptance criteria:
- [ ] 1 MB history POST rejected.
- [ ] `phase` must be a known enum.

Dependencies: none. Risk: Low. Size: S

---

## CI/CD

### GitHub Actions

| Workflow | Triggers | Checks | Deploy |
| --- | --- | --- | --- |
| `ci.yml` | push main, PR | `npm ci`, `prisma generate`, `npm run build` | no |
| `vercel-production.yml` | push main, dispatch | secret format script | `vercel build --prod` + `vercel deploy --prebuilt --prod` |
| `vercel-preview.yml` | PR to main, dispatch | same | preview + PR comment |

Neither workflow runs `npm test` or `npx eslint src`. Current eslint **fails** (VoiceOrb refs). Tests pass locally.

Vercel CLI: `npm install --global vercel@latest` — **unpinned**.

Concurrency: production group `vercel-production` cancel-in-progress true; preview per PR.

Environments: both deploys use GitHub environment `Prod` (preview is not isolated).

No Prisma migrate step. No health check. No rollback job.

### Commit amend (production and preview)

```yaml
git commit --amend --no-edit --reset-author
```

This creates a **new commit SHA** that is not `main`’s SHA. Vercel deploys that amended commit. GitHub `main` still points at the original. Consequences:

- Deployment provenance is false: production is not “what GitHub shows for main”.
- `cancel-in-progress` + amend races.
- Signed commits are destroyed.
- Debug (“what is live?”) requires Vercel, not `git fetch`.

Hobby-plan author matching is the stated reason in `README.md`. Safer options: GitHub merge commits already authored as the GitHub user; `git config` for future commits; Vercel Git integration without Actions amend; or a deploy-only bot user. **Do not amend.**

### Duplicate deployments

Push to `main` can trigger Vercel Git integration **and** Actions `vercel deploy`. Duplicate prod deploys, extra minutes, race on which wins.

### Next.js / Prisma on CI

CI `DATABASE_URL` is a dummy local Postgres string; `next build` does not need a live DB if pages that query are dynamic. Build succeeded in this audit against the developer’s env. CI may still succeed without Postgres because `prisma generate` does not connect.

Seed is destructive — never run in production CI.

### Required remediations (external)

- Upstash/Vercel KV for rate limits.
- Production `APP_URL`, `INGEST_API_KEY`, `AUTH_SECRET`, `ADMIN_PASSWORD` already required.
- Optional: Cloudflare Access in front of `/api/mcp`.
- Pin `vercel@VERSION`.
- Stop commit amend; confirm Vercel GitHub app deploy XOR Actions deploy, not both.
