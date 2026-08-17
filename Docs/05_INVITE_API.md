# Invite API and ChatGPT MCP plugin

Create unique interview links from company/contact data.

Base URL: `https://www.bussnes-research.am`

---

## ChatGPT custom MCP plugin

The ChatGPT plugin form needs an **MCP server URL**, not the site root and not the REST path.

**MCP URL:** `https://www.bussnes-research.am/api/mcp`

Authentication in the ChatGPT form: **None**.  
`INGEST_API_KEY` stays on the server. ChatGPT never sends it.

Tool: `createInterviewInvitation`

```json
{
  "firstName": "Ani",
  "lastName": "Hakobyan",
  "role": "COO",
  "email": "ani@company.am",
  "language": "hy",
  "companyName": "Example LLC",
  "vertical": "Wholesale",
  "website": "https://company.am",
  "employeeRange": "20-40",
  "notes": "...",
  "verifiedFacts": [],
  "hypotheses": []
}
```

Required: `firstName`, `role`, `companyName`  
The tool returns `interviewUrl` to put in the email.

After deploy, paste exactly:

`https://www.bussnes-research.am/api/mcp`

If this app is served from another host, use that host + `/api/mcp`.

---

## REST (curl / internal)

`POST https://www.bussnes-research.am/api/invitations`

Auth: `Authorization: Bearer <INGEST_API_KEY>`  
The key lives in `.env` as `INGEST_API_KEY`.

```bash
curl -X POST https://www.bussnes-research.am/api/invitations \
  -H "Authorization: Bearer $INGEST_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Ani","role":"COO","email":"ani@company.am","companyName":"Example LLC","vertical":"Wholesale","language":"hy"}'
```

Response includes `interviewUrl`. The plaintext link is returned once.

Same company/contact is reused if it already exists; each call still creates a **new** link.

OpenAPI: `GET /api/invitations/spec` (Bearer required)

Production `APP_URL` must be `https://www.bussnes-research.am` so returned links use that host.
