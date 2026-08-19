# Audio pipeline and Realtime configuration audit

Official sources used in this file:

- [Realtime transcription](https://developers.openai.com/api/docs/guides/realtime-transcription)
- [Voice activity detection](https://developers.openai.com/api/docs/guides/realtime-vad)
- [Realtime WebRTC](https://developers.openai.com/api/docs/guides/realtime-webrtc)
- [Agents SDK — building voice agents](https://openai.github.io/openai-agents-js/guides/voice-agents/build/)
- [gpt-realtime-2.1](https://developers.openai.com/api/docs/models/gpt-realtime-2.1)

## Audio-processing stages in order

### 1. Browser microphone constraints

File: `InterviewClient.tsx` `connectVoice` 714–721.

```ts
audio: {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  channelCount: 1,
}
```

| Question | Answer |
| --- | --- |
| Necessary? | Yes. Browser AEC is the right first line against assistant playback echo. |
| Supported by measurements? | No in-repo telemetry of constraint success (`getSettings()` is never logged). |
| Can it clip speech? | AGC can pump quiet speech; NS can soften fricatives. Usually acceptable. |
| Quiet Armenian speech? | Usually preserved. |
| Conflict? | Overlaps with custom RMS gate and Realtime `near_field` NR. |
| Device-dependent? | Yes. Constraints are hints. Bluetooth headsets often implement weak AEC. |
| Hard-coded? | Yes. No per-device profile. |
| Duplicates WebRTC/Realtime? | Complements them. Keep. |

### 2–4. Echo cancellation, noise suppression, AGC

All three are the browser’s native processing on the captured track. Necessary. Not measured. Should remain enabled.

### 5–9. Custom Web Audio: high-pass, RMS, noise gating, destination stream

File: `src/lib/interview/mic-processing.ts`. Constants in `realtime-config.ts`:

```ts
MIC_PROCESSING = { highpassHz: 85, gateOpenRms: 0.02, gateCloseRms: 0.01, hangoverMs: 280 }
```

Chain: `MediaStreamSource → BiquadFilter(highpass 85 Hz, Q 0.7) → Analyser + Gain → MediaStreamDestination`.

Gain starts at **0**. Gate opens when byte-time-domain RMS ≥ 0.02, hangs 280ms, closes below 0.01. `setTargetAtTime` time constant 0.02s.

The processed **destination** stream is what `OpenAIRealtimeWebRTC` sends. The original track is also connected to a separate analyser for the orb UI.

| Question | Answer |
| --- | --- |
| Necessary? | No. Browser NS + Realtime `near_field` already reduce noise. Semantic VAD already ignores non-speech. |
| Supported by measurements? | No. Thresholds are unexplained magic numbers. |
| Can it clip speech? | **Yes.** Onsets below 0.02 RMS never open the gate. Hangover can still chop tails. |
| Quiet Armenian speech? | **High risk.** Eastern Armenian voiceless consonants and quiet laptop speech often sit near the noise floor. |
| Short answers? | `այո` / `ոչ` / `հա` may never open the gate, and even if they do, stage 13 can still delete them. |
| Conflict? | Yes: triple noise control (browser NS, custom gate, server NR). The custom gate is the only one that can zero the send stream. |
| Device-dependent? | Extremely. Bluetooth mics often report lower RMS. MacBook mics are hotter than many Windows laptops. |
| Hard-coded? | Yes. |
| Duplicates platform? | **Yes.** |

RMS is computed from `Uint8Array` time-domain data centered at 128. That is a coarse, uncalibrated loudness estimate, not dBFS.

### 10. Track enabling / disabling

`applyMicGate` (`InterviewClient` 256–271) disables tracks when user-muted, tools pending, listening not open, or ending. During the opening, tracks are disabled so the respondent cannot barge into the greeting. That is reasonable.

Mic is **not** muted while the assistant speaks, so barge-in remains possible. Combined with a custom gate, echo from playback can still open the gate on some devices.

### 11. Realtime server noise reduction

`REALTIME_NOISE_REDUCTION = { type: "near_field" }` applied in:

- `mintRealtimeClientSecret` (`realtime.ts` 37–39)
- `RealtimeSession` config (`InterviewClient` 908–910)
- `session.update` (`setVadAutoResponse` 306–308)

`near_field` is appropriate for laptop interviews. `far_field` would be for room mics. Keep one server setting; do not also gate in the browser.

### 12. VAD

`VOICE_TURN_CONFIG`:

```ts
{
  type: "semantic_vad",
  eagerness: "low",
  createResponse: false, // flipped true after openListening
  interruptResponse: false,
  prefixPaddingMs: 400,    // unused in API payloads
  silenceDurationMs: 900,  // unused
  threshold: 0.45,         // unused
}
```

Official semantic VAD fields are `eagerness`, `create_response`, `interrupt_response`. `threshold` / `prefix_padding_ms` / `silence_duration_ms` belong to **server_vad** only ([VAD guide](https://developers.openai.com/api/docs/guides/realtime-vad)).

`eagerness: "low"` is the right starting point for long operational answers with pauses. Docs/01 suggested `medium`. Current code chose patience. That should be A/B tested, not hard-coded forever.

`create_response` is false at connect so the opening can be a manual `response.create`, then true so VAD auto-answers. That is a coherent design. It is also a source of races: noise heuristics cancel responses while VAD may already be creating one.

### 13. Interruption handling

Custom barge-in: 350ms of detected speech while AI is speaking → `session.interrupt()`. Speech < 350ms → `input_audio_buffer.clear`.

Native path: `interrupt_response: true` lets the Realtime API cancel the assistant when VAD sees user speech ([VAD guide](https://developers.openai.com/api/docs/guides/realtime-vad), [Agents SDK build guide](https://openai.github.io/openai-agents-js/guides/voice-agents/build/)).

Current custom logic exists because interrupt is disabled. It is the same code path that deletes short answers.

### 14. Assistant audio playback

Handled by `OpenAIRealtimeWebRTC` (SDK plays remote audio). Client taps the remote track into an analyser for the orb (`changePeerConnection` track listener). AI-speaking heuristics: RMS × 5.8, start > 0.06, end < 0.02, plus 400ms hold (`endAiSpeech`). Those thresholds affect UI and barge-in arming, not the send stream.

---

## Recommendation for custom microphone processing

**Disable by default behind a feature flag, then delete after the gold-set eval.**

Do not keep it on for the first 20–30 interviews.

Reasons, from code:

1. It is the only stage that can send digital silence to OpenAI.
2. Thresholds are not calibrated per device.
3. It duplicates browser NS + Realtime NR + semantic VAD.
4. Combined with 350ms buffer-clear, it specifically threatens Armenian closed-class words.
5. Failure already falls back to the raw stream (`MIC_PROCESSING_FALLBACK`), which is an implicit admission that the processor is optional.

Keep browser `echoCancellation` / `noiseSuppression` / `autoGainControl`. Keep server `near_field`. Optionally log `track.getSettings()` once per session for later device analysis.

---

## Realtime configuration duplication

Configuration is applied in **three** places. Later `session.update` can overwrite the mint + SDK connect config.

| Field | Token mint (`realtime.ts`) | `RealtimeSession` constructor | `setVadAutoResponse` |
| --- | --- | --- | --- |
| model | yes | yes | no |
| instructions | yes | agent.instructions | optional overwrite |
| voice | output.voice | config.voice + output.voice | no |
| turn_detection type | semantic_vad | semantic_vad | semantic_vad |
| eagerness | low | low | low |
| create_response | false | false | **toggled** |
| interrupt_response | false | false | false |
| prefix/silence/threshold | **omitted** (good) | **omitted** | **omitted** |
| noise_reduction | near_field | near_field | near_field |
| transcription.model | gpt-live-transcribe | gpt-live-transcribe | gpt-live-transcribe |
| transcription.language | `"hy"` | `"hy"` | `"hy"` |
| transcription.languages | **absent** | **absent** | **absent** |
| transcription.keywords | absent | absent | absent |
| transcription.delay | absent | absent | absent |
| reasoning.effort | absent | absent | absent |
| output_modalities | absent (SDK sets audio) | `["audio"]` | absent |

`voiceTurnDetection()` still **computes** server-VAD fields, then mint/update **drop** them. Dead config, not a runtime overwrite bug.

### [P0] Transcription hard-coded to singular `language: "hy"`

Status: Confirmed bug

Evidence:
- File: `src/lib/openai/realtime-config.ts` lines 3–5; `realtime.ts` 40–46; `InterviewClient.tsx` 911–915 and 309–313
- Function or lines: `REALTIME_TRANSCRIBE_LANGUAGE`, `mintRealtimeClientSecret`, `setVadAutoResponse`
- Current behavior: every session, including `language=ru` and `language=en` interviews, asks `gpt-live-transcribe` for Armenian-script output.

Official API behavior:
- [Realtime transcription](https://developers.openai.com/api/docs/guides/realtime-transcription): `gpt-live-transcribe` uses `languages` (array). **Do not send both `language` and `languages`.**
- Agents SDK build guide example: `languages: ['en', 'ja']`, plus `prompt` and `keywords`.

Why it matters:
- User impact: Russian/English interviews are forced toward Armenian script; code-switching is transcribed poorly.
- Data impact: mixed utterances become garbled, then quality heuristics treat them as noise or demand clarification.
- Production impact: the product claims hy/ru/en support; STT does not.

Recommended change:
1. Build transcription from interview language: default `languages: ["hy", "ru", "en"]` for Armenian interviews (code-switching); `["ru", "hy", "en"]` for Russian; `["en", "hy", "ru"]` for English.
2. Send `languages` only. Never `language`.
3. Add `keywords` from company name, systems, 1C, ArmSoft, Excel, ERP, CRM, SKU, API, WhatsApp, Telegram, respondent name.
4. Add a setting-specific `prompt` (not “always Armenian script” for ru/en).
5. Set `delay: "low"` or `"medium"` and evaluate number accuracy.

Acceptance criteria:
- [ ] Russian interview transcripts stay in Cyrillic when the respondent speaks Russian.
- [ ] Armenian interviews still prefer Armenian script but keep Latin product names.
- [ ] Session payload contains `languages` and does not contain `language`.
- [ ] Keywords include at least company name and configured system terms.

Dependencies: none (API already supports this).

Risk: Medium (wrong language order can bias STT).

Estimated size: S

### [P1] Semantic VAD includes unused server-VAD fields

Status: Cleanup

Evidence:
- File: `src/lib/openai/realtime-config.ts` 12–19, 49–58
- Function or lines: `VOICE_TURN_CONFIG`, `voiceTurnDetection`
- Current behavior: `prefixPaddingMs`, `silenceDurationMs`, `threshold` are returned by `voiceTurnDetection` but stripped before the API.

Official API: those fields apply to `server_vad` only.

Recommended change: delete them from the semantic config object so future copy-paste cannot send an invalid mix.

Acceptance criteria:
- [ ] No server-VAD keys in semantic_vad objects.
- [ ] Comment points to the VAD guide.

Dependencies: none. Risk: Low. Size: XS

### [P1] Native interruption is disabled in favor of custom barge-in that drops short audio

Status: High-risk design

Evidence:
- File: `realtime-config.ts` `interruptResponse: false`; `InterviewClient.tsx` 433–493
- Current behavior: client waits 350ms then `interrupt()`; short bursts clear the buffer.

Official API: `interrupt_response: true` with semantic VAD is the supported barge-in path. Agents SDK documents `session.interrupt()` for a **manual stop button**, not as a replacement for VAD interruption.

Recommended change:
1. Feature-flag `NATIVE_INTERRUPT=true` for eval.
2. Keep custom `session.interrupt()` only for an explicit UI stop, if any.
3. Remove duration-based `input_audio_buffer.clear`.

Acceptance criteria:
- [ ] Respondent can interrupt after a short `ոչ` without losing that word.
- [ ] Assistant audio stops on barge-in in WebRTC.
- [ ] A/B notes recorded in the eval scorecard.

Dependencies: Phase 1 audio flag. Risk: Medium. Size: S

### [P2] reasoning.effort and transcription.delay are unset

Status: Improvement

Evidence:
- File: `InterviewClient.tsx` RealtimeSession config 894–921; `realtime.ts` mint body
- Current behavior: no `reasoning` block; no `delay`.

Official API: gpt-realtime-2.1 supports configurable reasoning effort; OpenAI suggests starting at `low` for production voice agents. `gpt-live-transcribe` `delay` trades partial-transcript latency for accuracy.

Recommended change: set `reasoning: { effort: "low" }` and `transcription.delay: "medium"` for number-critical interviews; evaluate `low` if latency suffers.

Acceptance criteria:
- [ ] Config visible in one factory (no triplication).
- [ ] Latency and number-accuracy measured.

Dependencies: config factory refactor. Risk: Low. Size: S

### [P2] Voice is `sage`; OpenAI currently recommends `marin` or `cedar` for best quality

Status: Improvement

Evidence: `DEFAULT_REALTIME_VOICE = "sage"`; [Realtime conversations](https://developers.openai.com/api/docs/guides/realtime-conversations) recommends `marin` or `cedar`.

Do not switch in production without native Armenian listening tests. See Phase 4.

### [P2] No OpenAI-Safety-Identifier on client_secrets

Status: Improvement

Evidence: `realtime.ts` fetch headers are only Authorization + Content-Type. [WebRTC guide](https://developers.openai.com/api/docs/guides/realtime-webrtc) says to set `OpenAI-Safety-Identifier` on the server mint request.

Recommended change: hash `interviewId` (not the public token) and send it.

Acceptance criteria:
- [ ] Header present on mint.
- [ ] Value is a hash, not PII.

Dependencies: none. Risk: Low. Size: XS

### Target Realtime factory

One function should produce the session object used by mint, SDK construct, and `session.update` (with only `create_response` differing):

```ts
{
  type: "realtime",
  model: "gpt-realtime-2.1",
  output_modalities: ["audio"],
  reasoning: { effort: "low" },
  audio: {
    input: {
      turn_detection: {
        type: "semantic_vad",
        eagerness: "low" | "medium", // eval
        create_response: boolean,
        interrupt_response: true,     // after eval
      },
      noise_reduction: { type: "near_field" },
      transcription: {
        model: "gpt-live-transcribe",
        languages: ["hy", "ru", "en"],
        prompt: dynamicPrompt,
        keywords: dynamicKeywords,
        delay: "medium",
      },
    },
    output: { voice: chosenVoice },
  },
}
```

VAD eagerness by phase is a Phase 4 experiment (`low` in deep-dive, `medium` in intro/close). Do not ship dynamic VAD until the gold set exists.
