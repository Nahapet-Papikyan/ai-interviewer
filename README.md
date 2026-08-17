# Business Discovery Voice Agent

Internal customer-discovery interviews for Armenian companies: unique `/i/{token}` links, Eastern Armenian voice via OpenAI Realtime, then Structured Outputs analysis into a research dashboard.

## Setup

1. Copy `.env.example` to `.env.local` and fill secrets.
2. `npm install`
3. `npx prisma db push`
4. `npx prisma db seed` (prints invitation URLs)
5. `npm run dev`

Admin: http://localhost:3000/login

## Deploy (GitHub → Vercel)

The first Production deploy worked because Vercel imported the repo as your account. Later deploys are blocked when GitHub cannot match the **commit author email** to the `Nahapet-Papikyan` user. That is the error: *GitHub could not associate the committer with a GitHub user.*

Use this commit email (GitHub’s private noreply for this account):

`64918606+Nahapet-Papikyan@users.noreply.github.com`

Do not paste a GitHub tree URL into Vercel’s Create Deployment field. Enter `main`, or wait for the push to deploy.

GitHub Actions **Deploy production** still runs on push to `main` and reads Vercel secrets from the **Prod** environment.

1. Import the repo in Vercel: [vercel.com/new](https://vercel.com/new) → **Nahapet-Papikyan/ai-interviewer**.
2. In Vercel → Account → [Authentication](https://vercel.com/account/authentication), connect the **Nahapet-Papikyan** GitHub account.
3. Add these environment variables in Vercel (Production + Preview):
   - `DATABASE_URL`
   - `OPENAI_API_KEY`
   - `OPENAI_REALTIME_MODEL`
   - `OPENAI_ANALYSIS_MODEL`
   - `ADMIN_PASSWORD`
   - `AUTH_SECRET`
   - `FTE_HOURS_PER_MONTH`
   - `APP_URL` (your `https://….vercel.app` URL, or a custom domain)
   - `INGEST_API_KEY` (optional; required for `/api/invitations`)
4. Create a Vercel token: [vercel.com/account/tokens](https://vercel.com/account/tokens).
5. Copy **Project ID** and **Team ID** from Vercel → Project Settings → General (they also appear in `.vercel/project.json` after `npx vercel link`).
6. In GitHub → **Settings → Environments → Prod**, add these **Vercel** values (not GitHub IDs):
   - `VERCEL_TOKEN` — from [vercel.com/account/tokens](https://vercel.com/account/tokens), same Vercel account that owns the project
   - `VERCEL_ORG_ID` — Vercel **Team ID**, starts with `team_` (Hobby team → Settings → General). Never the GitHub environment number in the URL.
   - `VERCEL_PROJECT_ID` — Vercel **Project ID**, starts with `prj_` (project → Settings → General)
7. Open GitHub → **Actions** and confirm **Deploy production** is green. `Project not found` means the Team ID, Project ID, or token belong to different Vercel accounts, or the two IDs were swapped.

After the first deploy, point `APP_URL` at the live URL and apply the schema once:

```bash
npx prisma db push
npx prisma db seed
```

## Notes

- Permanent `OPENAI_API_KEY` stays on the server. Browsers receive short-lived `ek_` tokens.
- Raw audio is not stored. Transcript + JSON findings only.
- Do not cold-outreach until `src/eval/` quality gates pass.
