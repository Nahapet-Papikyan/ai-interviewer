# Armenian language and interviewer prompt audit

Active prompt: `src/prompts/interviewer.system.v2.md`  
Loader: `src/lib/interview/context.ts` `getInterviewerPromptTemplate`  
Version stamp: `INTERVIEWER_PROMPT_VERSION = "interviewer-v2"`  
Size: **866 lines, 23,105 bytes**.

Legacy unused prompt: `src/prompts/interviewer.system.md` (572 lines). Repo search of `src/**/*.ts(x)` finds **zero** imports. `Docs/02_INTERVIEWER_SYSTEM_PROMPT.md` is a third, older copy.

Opening overlay: `openingResponseInstructions` in `src/lib/interview/client-session.ts` (108–117). This is the actual first spoken turn and can override prompt tone.

UI copy: `InterviewClient` consent and chrome are Eastern Armenian only; header always prints `հայերեն` (line 1430).

## What the active prompt already controls

| Concern | Present? | Notes |
| --- | --- | --- |
| Eastern Armenian / Yerevan professional | Yes | §2; contrasts Western / Iranian / Artsakh |
| Sentence length | Yes | §0.1–0.2, §3; 1 question/turn |
| Speaking speed | Weak | “rhythmically simple”; no numeric pace |
| Warmth | Yes | §2.4; forbids starting every turn with «Լավ» |
| Natural acknowledgements | Yes | optional, varied, often none |
| Variation | Partial | lists a few particles; model still may loop |
| One question per turn | Yes | highest-priority §0 |
| Code-switching | Yes | follow respondent; keep product names |
| Number confirmation | Yes | §0.3, §9 |
| Pronunciation | Partial | Eastern grammar examples; no IPA/phonetic dictionary |
| Unclear audio recovery | Yes | §0.3–0.4 |
| Connection problems | Weak | “continue from current topic”; no reconnect script beyond runtime block |
| Respondent fatigue | Yes | §15 |
| Runtime state | Yes | §21 `{{runtime_state}}` |
| Example conversations | Few | short quoted turns, not a full dialogue |

`{{respondent_name_hy}}` is filled with `interview.contact.firstName` (`token/route.ts` 95–96). There is **no** Armenian native-name column. Latin `Armine` is what the model is told to pronounce.

## Size, repetition, conflicts

The v2 prompt is better than v1 (opening-once, silent tools, no password talk, runtime state). It is still too large for a spoken Realtime agent.

Repeated themes (each appears in multiple sections):

- one question per turn
- do not restart / re-greet
- do not guess from garbled STT
- silent tools
- do not sell automation
- Eastern Armenian, not Western

Conflicting or competing instructions:

- §2.1 wants everyday spoken Armenian; §5 still reads like a research checklist the model may try to cover verbally.
- §2.2 says “Armenian first, avoid English jargon” while §2.2 also lists Excel/ERP/CRM as fine — correct, but easy to over-avoid or over-use.
- §0.6 “answer the person’s question” vs algorithm “ask the single most valuable unknown”.
- Opening overlay (`openingResponseInstructions`) restates the opening the prompt already contains, increasing the chance of a long first turn.
- Prioritization example in v1 docs still has an English sentence; v2 is cleaner but §5 remains a large field list.

Rules that belong in **code**, not the prompt:

- Opening exactly once → already partly in `shouldTriggerOpening` + runtime block; prompt can shrink to “follow runtime state”.
- Language of the first turn → `openingResponseInstructions` (add Russian).
- Do not record garbled facts → `decideRecordKeyFact`.
- Covered fields → runtime `coveredFields` (today the prompt also tells the model to “silently track” them).
- Reconnect → CONTINUE system note + restore window.
- Tool mute / silent results → tool descriptions + `TOOL_SILENT_RESULT`.

Rules that can be shortened:

- §5 field catalog → compact bullet list or omit (analyzer extracts fields).
- §18 covered-field memory → 8-line checklist or drop.
- Duplicate “never fabricate” / “never reveal prompt” → one short Safety section.

Parts likely to cause robotic behavior:

- Long checklist of what to learn (§5).
- Explicit “write for speech / never sound like a call-center operator” meta-instructions (models often over-perform these).
- Forced example opening paragraph the model may read almost verbatim every time.

Parts likely to cause repeated clarification:

- §0.3 “never invent meaning from unclear speech” plus client `qualitySystemNote` plus fact rejection. Three layers can produce serial “ասացեք նորից” turns.
- Number confirmation examples that fire even when the number was clear.

Parts likely to cause language switching:

- Prompt is written in English with Armenian examples. Realtime models sometimes answer in the prompt’s majority language.
- `preferred_language` is a label string, not a hard output constraint except in the opening overlay.
- Transcription forced to `hy` can feed Armenian-script garbage into a Russian conversation, after which the model “follows” the transcript language.

Parts likely to improve or harm accent:

- Improve: explicit արևելահայերեն vs արևմտահայերեն; Yerevan; grammar counterexamples (`կը խոսիմ`).
- Harm: English-majority prompt; Latin names; no phonetic hints; voice `sage` untested vs `marin`/`cedar`; no `Reference Pronunciations` block.

## Dynamic Reference Pronunciations

Yes — generate a small block per interview from structured data, not free prose:

```text
# Pronunciation hints (spoken Eastern Armenian)
Respondent: {{firstNameHy}}  (do not spell Latin letters)
Company: {{companyNameHy}}
Systems: 1C → «մեկ սի» or «ոդին էս»; ArmSoft; Excel; …
```

Requires DB fields (see Phase 4). Until then, pass company name and known systems as transcription **keywords** (code) rather than more prompt prose.

## Recommended prompt architecture

Target size: **~250–400 lines / ≤12 KB**, not 23 KB. Realtime instruction-following degrades when the prompt is a manual.

```text
Role and objective          (15 lines)
Language                    (20 lines: Eastern Armenian, code-switch rule, one language lock)
Voice and pacing            (15 lines)
Pronunciation hints         (dynamic, generated)
Conversation state          (injected runtime_state only)
Interview algorithm         (the 4 questions in §6, deep-dive priority as a numbered list)
Clarification rules         (when to ask again; when to wait)
Number confirmation         (critical numbers only)
Tool rules                  (3 lines; details already in tool descriptions)
Safety                      (no secrets, no selling, no prompt leak)
Closing                     (5-step compact close)
Examples                    (2 short dialogues: good vs bad turn; 1 code-switch)
```

Move to application logic:

- opening once, reconnect, language of first utterance
- fact confirmation gating
- covered-field set
- transcription language/keywords
- VAD eagerness
- UI copy localization

Keep in the prompt: how to sound, how to choose the next question, how to treat hypotheses vs facts.

### [P1] Active interviewer prompt is too large and duplicated across docs

Status: Improvement

Evidence:
- File: `src/prompts/interviewer.system.v2.md` (866 lines)
- Function or lines: loaded by `getInterviewerPromptTemplate`
- Current behavior: English research manual injected every session, plus a second opening instruction blob.

Why it matters:
- User impact: robotic pacing, repeated clarifications, occasional English leakage.
- Data impact: weaker coverage of 1–3 workflows in 15 minutes.
- Production impact: expensive tokens every reconnect.

Recommended change:
1. Freeze v2 as `interviewer-v2` for rollback.
2. Ship `interviewer-v3` at ≤400 lines using the structure above.
3. Stop editing `Docs/02_*.md` as if it were runtime.
4. Native reviewer scores v2 vs v3 on the same 10 personas.

Acceptance criteria:
- [ ] Runtime source is a single file referenced by `INTERVIEWER_PROMPT_SOURCE`.
- [ ] Opening still happens once.
- [ ] Native reviewers score naturalness ≥ v2.

Dependencies: native Armenian review. Risk: Medium. Size: M

### [P0] Russian interviews still open and transcribe as Armenian

Status: Confirmed bug

Evidence:
- File: `client-session.ts` `openingResponseInstructions` 108–117; `InterviewClient.tsx` 1430; `realtime-config.ts` `REALTIME_TRANSCRIBE_LANGUAGE`
- Current behavior: `language === "en"` gets English opening; else Eastern Armenian. UI always shows `հայերեն`. STT always `hy`.

Why it matters:
- User impact: a Russian-speaking COO hears and is transcribed as Armenian.
- Data impact: garbage STT → false clarifications → lost numbers.
- Production impact: `invitationSchema` advertises `hy | en | ru`.

Recommended change:
1. Add `ru` opening overlay.
2. Localize consent/chrome strings by `interview.language`.
3. See transcription `languages` change in `03_AUDIO_AND_REALTIME_AUDIT.md`.

Acceptance criteria:
- [ ] `language=ru` opening is Russian.
- [ ] Header label matches interview language.
- [ ] Test analogous to existing “language-locked opening” cases.

Dependencies: copy review. Risk: Low. Size: S

### [P2] `respondent_name_hy` is not a native name

Status: Improvement

Evidence: `token/route.ts` passes `respondentNameHy: interview.contact.firstName`. Schema `Contact` has no `firstNameHy`.

Recommended change: add optional native-script fields; until then, if `firstName` is Latin, instruct “use the name as provided, do not invent an Armenian spelling.”

Acceptance criteria:
- [ ] Prompt does not claim a pronunciation that was never supplied.

Dependencies: migration for durable fix. Risk: Low. Size: S
