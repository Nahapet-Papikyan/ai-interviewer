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

Pushes to `main` run GitHub Actions, which build the app and deploy to Vercel. Preview deploys run on pull requests.

1. Import the repo in Vercel: [vercel.com/new](https://vercel.com/new) → **Nahapet-Papikyan/ai-interviewer**.
2. Add these environment variables in Vercel (Production + Preview):
   - `DATABASE_URL`
   - `OPENAI_API_KEY`
   - `OPENAI_REALTIME_MODEL`
   - `OPENAI_ANALYSIS_MODEL`
   - `ADMIN_PASSWORD`
   - `AUTH_SECRET`
   - `FTE_HOURS_PER_MONTH`
   - `APP_URL` (your `https://….vercel.app` URL, or a custom domain)
3. Create a Vercel token: [vercel.com/account/tokens](https://vercel.com/account/tokens).
4. Copy **Project ID** and **Org/Team ID** from Vercel → Project Settings → General (they also appear in `.vercel/project.json` after `npx vercel link`).
5. In GitHub → **Settings → Secrets and variables → Actions**, add:
   - `VERCEL_TOKEN`
   - `VERCEL_ORG_ID`
   - `VERCEL_PROJECT_ID`
6. Re-run **Vercel Production Deployment** (or push to `main`). Native Vercel Git deploys are disabled in `vercel.json` so only GitHub Actions deploys.

After the first deploy, point `APP_URL` at the live URL and apply the schema once:

```bash
npx prisma db push
npx prisma db seed
```

## Notes

- Permanent `OPENAI_API_KEY` stays on the server. Browsers receive short-lived `ek_` tokens.
- Raw audio is not stored. Transcript + JSON findings only.
- Do not cold-outreach until `src/eval/` quality gates pass.
