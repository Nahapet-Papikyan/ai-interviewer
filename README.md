# Business Discovery Voice Agent

Internal customer-discovery interviews for Armenian companies: unique `/i/{token}` links, Eastern Armenian voice via OpenAI Realtime, then Structured Outputs analysis into a research dashboard.

## Setup

1. Copy `.env.example` to `.env.local` and fill secrets.
2. `npm install`
3. `npx prisma db push`
4. `npx prisma db seed` (prints invitation URLs)
5. `npm run dev`

Admin: http://localhost:3000/login

## Deploy (GitHub Actions → Vercel)

Autodeploy does **not** use Vercel’s Git integration. That path rejects commits whose author email is not a verified address on the connected GitHub account (this repo’s commits currently use `nahapetpapikyanl@gmail.com`). `vercel.json` keeps native Git deploys off so that modal can be ignored.

Every push to `main` runs **Deploy production**. Pull requests run **Deploy preview**. You can also run either workflow by hand from the Actions tab.

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
5. Copy **Project ID** and **Org/Team ID** from Vercel → Project Settings → General (they also appear in `.vercel/project.json` after `npx vercel link`).
6. In GitHub → **Settings → Secrets and variables → Actions**, add:
   - `VERCEL_TOKEN`
   - `VERCEL_ORG_ID`
   - `VERCEL_PROJECT_ID`
7. Open GitHub → **Actions** and confirm **Deploy production** is green. If it fails on missing secrets, step 6 is incomplete.

Optional, if you want Vercel’s own Git deploys later: add the email from `git log -1 --format='%ae'` to [GitHub emails](https://github.com/settings/emails) and [Vercel emails](https://vercel.com/account/settings), then remove `"git": { "deploymentEnabled": false }` from `vercel.json`. Until then, ignore the Vercel “Fix Git Configuration” prompt.

After the first deploy, point `APP_URL` at the live URL and apply the schema once:

```bash
npx prisma db push
npx prisma db seed
```

## Notes

- Permanent `OPENAI_API_KEY` stays on the server. Browsers receive short-lived `ek_` tokens.
- Raw audio is not stored. Transcript + JSON findings only.
- Do not cold-outreach until `src/eval/` quality gates pass.
