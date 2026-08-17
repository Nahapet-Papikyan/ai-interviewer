# Invite API — create interview links

Use this from ChatGPT (Custom GPT Actions) or any client to store company/contact data and get a unique interview URL to send by email.

Base URL: `https://www.bussnes-research.am`

Auth: `Authorization: Bearer <INGEST_API_KEY>`  
The key lives in `.env` as `INGEST_API_KEY`.

---

## Create interview link

`POST https://www.bussnes-research.am/api/invitations`

**Body**

```json
{
  "firstName": "Ani",
  "lastName": "Hakobyan",
  "role": "COO",
  "email": "ani@company.am",
  "phone": "+374...",
  "language": "hy",
  "companyName": "Example LLC",
  "vertical": "Wholesale",
  "website": "https://company.am",
  "employeeRange": "20-40",
  "notes": "Reached via intro call",
  "verifiedFacts": ["Uses 1C for sales"],
  "hypotheses": ["Order confirmation may still be manual"]
}
```

Required: `firstName`, `role`, `companyName`  
Optional: everything else. `language`: `hy` | `en` | `ru` (default `hy`)

**Response**

```json
{
  "interviewUrl": "https://www.bussnes-research.am/i/...",
  "interviewId": "...",
  "companyName": "Example LLC",
  "respondentName": "Ani",
  "language": "hy"
}
```

Send `interviewUrl` by email. The plaintext link is returned once.

Same company/contact is reused if it already exists; each call still creates a **new** link.

---

## curl

```bash
curl -X POST https://www.bussnes-research.am/api/invitations \
  -H "Authorization: Bearer $INGEST_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Ani","role":"COO","email":"ani@company.am","companyName":"Example LLC","vertical":"Wholesale","language":"hy"}'
```

---

## ChatGPT Custom GPT Action

1. Import schema: `GET https://www.bussnes-research.am/api/invitations/spec` (same Bearer token)
2. Authentication: Bearer → `INGEST_API_KEY`
3. Instruct the GPT: collect company + respondent details, call `createInterviewInvitation`, then return only `interviewUrl` for the email

Production `APP_URL` must be `https://www.bussnes-research.am` so returned links use that host. The live site must serve this Next.js app (or proxy `/api/invitations` and `/i/{token}` to it).
