# MVP Implementation Specification

## 1. Realtime architecture

### Browser

Create a `RealtimeAgent` and `RealtimeSession` using
`@openai/agents/realtime`.

Recommended model:

``` ts
model: "gpt-realtime-2.1"
```

Start with:

``` ts
audio.input.turnDetection = {
  type: "semantic_vad",
  eagerness: "medium",
  createResponse: true,
  interruptResponse: true
}
```

Reason: interview answers can be long and contain pauses. Semantic VAD
is preferable to treating every short silence as end-of-turn. Test
`medium` against real Armenian speakers before changing.

The browser must never receive `OPENAI_API_KEY`.

### Ephemeral token endpoint

`POST /api/realtime/token`

Input:

``` json
{ "interviewToken": "opaque-token" }
```

Server:

1.  validates invitation;
2.  checks status/expiry;
3.  loads company/contact context;
4.  builds the system instructions;
5.  calls OpenAI `POST /v1/realtime/client_secrets`;
6.  returns only the short-lived `ek_...` token and safe UI metadata.

The long-lived project key exists only in server environment variables.

### Sensitive tools

Function tools attached to a browser RealtimeSession execute in the
browser environment. Therefore tools that persist data or perform
privileged actions must call authenticated/authorized backend endpoints;
never embed DB credentials or privileged secrets in tool implementations
shipped to the browser.

## 2. Conversation lifecycle

Statuses:

``` text
INVITED
OPENED
CONSENTED
STARTED
IN_PROGRESS
COMPLETED
ABANDONED
FAILED
ANALYZING
ANALYZED
REVIEWED
FOLLOW_UP_READY
```

Events to persist:

-   invitation_opened
-   consent_accepted
-   session_started
-   history_updated
-   respondent_turn
-   assistant_turn
-   tool_call
-   interruption
-   session_ended
-   analysis_started/completed/failed

Persist incrementally. Do not wait until the end of a 20-minute session.

## 3. Personalization context

Do not put email in URL.

Use:

``` text
/i/4QqP0kSx7...
```

DB maps token hash → interview.

Prompt context should distinguish:

``` text
VERIFIED FACTS
- supplied by our admin/research and safe to mention

HYPOTHESES
- may guide questions but MUST NOT be presented as fact

RESPONDENT FACTS
- learned in this interview
```

Example:

``` json
{
  "respondent": {
    "firstName": "Armine",
    "role": "CEO"
  },
  "company": {
    "name": "MegaFood",
    "vertical": "FMCG distribution"
  },
  "verifiedFacts": [],
  "hypotheses": [
    "customer order intake may involve manual work",
    "supplier invoice processing may be high-volume"
  ]
}
```

## 4. Interview state

Do not make the prompt remember everything implicitly. Maintain a
lightweight state object on the server:

``` ts
type InterviewState = {
  phase:
    | "INTRO"
    | "BUSINESS_CONTEXT"
    | "DISCOVERY"
    | "PROCESS_DEEP_DIVE"
    | "PRIORITIZATION"
    | "SYSTEMS"
    | "BUYING_PILOT"
    | "CLOSE";

  candidateProcesses: ProcessCandidate[];
  activeProcessId?: string;
  coveredFields: string[];
  missingCriticalFields: string[];
  respondentFatigue: "LOW" | "MEDIUM" | "HIGH";
};
```

For MVP the realtime agent can reason from history + prompt. The state
object is primarily for observability and later deterministic
orchestration, not to force a rigid finite-state questionnaire.

## 5. Tools

Keep realtime tools small.

### `record_process_candidate`

Input:

``` json
{
  "name": "Customer order processing",
  "short_reason": "Repeated daily and requires manual entry"
}
```

Purpose: mark a promising process. This is provisional, not final
analysis.

### `record_key_fact`

``` json
{
  "category": "volume|time|people|system|error|impact|pilot",
  "value": "...",
  "process_name": "...",
  "evidence_summary": "Respondent said..."
}
```

Do not call this for every sentence.

### `mark_interview_complete`

Called only after closing and respondent has no additional process to
add.

**Important:** final metrics come from the post-interview analyzer, not
from these realtime tool calls.

## 6. Post-interview analysis pipeline

Trigger only when session is completed or manually requested for
abandoned interviews with enough data.

Inputs:

-   company/contact metadata;
-   ordered transcript;
-   provisional realtime facts;
-   analysis schema/version;
-   analyzer prompt version.

Output must be Structured Output JSON.

Pipeline:

``` text
Transcript
 → extraction
 → evidence linking
 → normalization
 → derived calculations
 → confidence
 → opportunity scoring
 → DB transaction
```

Never overwrite raw transcript.

Store:

-   raw evidence
-   normalized values
-   derived values

separately.

### Derived calculations

``` text
monthly_transactions =
  explicit monthly value
  OR daily * working_days
  OR weekly * 4.33

manual_hours_month =
  monthly_transactions * minutes_per_transaction / 60

fte_equivalent =
  manual_hours_month / configured_monthly_hours_per_fte
```

Use a configurable FTE assumption, e.g. `176 h/month`, and label it as
an assumption. Never present an inferred number as respondent-provided.

When ranges are given:

``` text
50–100 orders/day
```

store:

``` json
{ "min": 50, "max": 100, "point_estimate": 75 }
```

Do not collapse uncertainty.

## 7. Opportunity scoring

Use a transparent score, not AI intuition alone.

Example 0--100:

``` text
Volume                 0–20
Manual labor           0–20
Repetitiveness         0–15
Digital input quality  0–10
System accessibility   0–10
Error/business impact  0–10
Cross-company reuse    0–10
Pilot readiness        0–5
```

Then apply penalties:

``` text
Unstructured/physical-only input     -5..-15
No access to system/data             -5..-15
Highly judgment-dependent workflow   -5..-20
Regulatory/high-risk constraints     -5..-15
```

Store score components. Never store only `83`.

## 8. Database design

### companies

``` text
id uuid pk
name
legal_name nullable
website nullable
vertical
employee_range nullable
notes nullable
created_at
updated_at
```

### contacts

``` text
id uuid pk
company_id fk
first_name
last_name nullable
role
email nullable
linkedin_url nullable
phone nullable
preferred_language nullable
created_at
```

### interviews

``` text
id uuid pk
company_id fk
contact_id fk
public_token_hash unique
status
language
prompt_version
analysis_version
opened_at
started_at
completed_at
duration_seconds
created_at
```

### interview_messages

``` text
id uuid pk
interview_id fk
sequence_no
role user|assistant|system|tool
content_text
source realtime|manual
started_at nullable
ended_at nullable
created_at
```

Unique `(interview_id, sequence_no)`.

### processes

``` text
id uuid pk
interview_id fk
name
description
trigger
frequency_raw
transactions_day_min/max
transactions_month_min/max
minutes_transaction_min/max
employees_involved
manual_hours_month_min/max
fte_min/max
pain_score nullable
automation_score
confidence
created_at
```

### process_steps

``` text
id
process_id
step_no
actor
action
system
manual boolean
input
output
```

### process_evidence

``` text
id
process_id
message_id
field_name
evidence_text
evidence_type explicit|inferred|derived
confidence
```

### systems

Normalize later if needed. MVP can use
`process_systems(process_id, name, category)`.

### interview_analysis

``` text
id
interview_id
model
prompt_version
schema_version
raw_json jsonb
created_at
```

### opportunities

``` text
id
process_id
score_total
score_breakdown jsonb
automation_hypothesis
integration_requirements jsonb
risks jsonb
pilot_data_needed jsonb
pilot_readiness
```

## 9. Dashboard

### Overview

Cards:

-   invitations sent
-   opened
-   started
-   completed
-   completion rate
-   analyzed
-   companies with strong opportunity
-   pilot-ready companies

Charts/tables:

-   top process clusters
-   manual hours by process
-   opportunity score distribution
-   systems frequency (1C, Excel, email, ArmSoft...)
-   vertical × process matrix

### Interviews table

Columns:

``` text
Company
Contact
Role
Vertical
Status
Duration
# processes
Best opportunity
Best score
Pilot readiness
Completed at
```

Filters:

-   vertical
-   status
-   score
-   system
-   pilot readiness

### Interview detail

Show:

1.  company/contact;
2.  transcript;
3.  extracted processes;
4.  evidence for every important number;
5.  derived calculations;
6.  score breakdown;
7.  missing/uncertain data;
8.  suggested follow-up;
9.  human edit/review controls.

### Cross-company Process Explorer

This is strategically the most important screen.

Example:

``` text
Customer order processing — 8 companies
Median transactions/month: ...
Median manual hours/month: ...
1C present: 6/8
Excel present: 7/8
Pilot-ready: 3/8
```

The goal is to find repeatability, not merely produce pretty reports.

## 10. Armenian language/model choice

OpenAI's current model catalog states that latest models are
multilingual. For live voice, start with `gpt-realtime-2.1`; it is the
current default Realtime reasoning model with speech-to-speech, tool
use, improved noise/silence handling and interruption behavior.

However, do **not** assume Armenian quality is production-ready solely
from a generic multilingual claim. Before outreach run an explicit
Armenian benchmark:

-   Eastern Armenian formal business speech;
-   casual Armenian;
-   Armenian + Russian/English code switching;
-   numbers and currencies;
-   company/product names;
-   1C/ERP/Excel terminology;
-   noisy laptop microphone;
-   10--20 second answers;
-   long 60--120 second answers;
-   interruptions.

Compare `gpt-realtime-2.1` with `gpt-realtime-2.1-mini`. Use 2.1 if
quality materially improves; mini is much cheaper and may become useful
after validation.

Acceptance criteria: - respondent rarely repeats themselves; - numerical
facts are captured correctly; - Armenian replies sound natural enough
for a business interview; - no accidental switch to Russian/English
unless respondent does so; - interruptions work; - names/terms can be
corrected naturally.

## 11. API key

Create an OpenAI API Platform project and a **project-scoped key**.
Official OpenAI guidance allows API keys to be managed per project and
permissions restricted by endpoint.

Production:

``` env
OPENAI_API_KEY=sk-proj-...
OPENAI_REALTIME_MODEL=gpt-realtime-2.1
OPENAI_ANALYSIS_MODEL=gpt-5.6-terra
```

Never expose `OPENAI_API_KEY` through `NEXT_PUBLIC_*`, browser JS, logs,
URLs, analytics, or client errors.

The browser gets a fresh ephemeral client secret from your backend
immediately before connection.

## 12. Privacy / trust

Before microphone starts, clearly show:

-   this is an AI interviewer;
-   purpose of interview;
-   approximate duration;
-   what is stored (transcript + structured findings);
-   whether raw audio is stored (recommendation for MVP: **no**);
-   how results will be used;
-   that the respondent should avoid sharing passwords, personal
    customer data, bank details or other secrets;
-   explicit Start/Consent action.

For outreach research, validate Armenian/EU privacy and direct-marketing
requirements with counsel before scaling. Keep data minimization as
default.

## 13. Failure handling

-   microphone denied → offer text interview;
-   realtime connection fails → reconnect once and preserve transcript;
-   respondent leaves → ABANDONED; allow resume from same token;
-   analysis fails → retry idempotently;
-   analyzer sees conflicting numbers → store conflict, do not choose
    silently;
-   no meaningful process found → valid result; do not force an
    opportunity;
-   respondent asks "what do you know about us?" → only disclose
    verified context;
-   respondent asks to stop → end immediately.
