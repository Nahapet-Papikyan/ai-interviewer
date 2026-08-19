import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  rememberPersistEventId,
  wasOpeningTriggered,
  markOpeningTriggered,
  openingResponseInstructions,
} from "./client-session";
import { confirmedUserFactFromExchange, decideRecordKeyFact, laborLooksContradictory } from "./facts";
import { deriveLabor, deriveMonthlyTransactions } from "./metrics";
import { planTranscriptUpsert } from "./messages";
import {
  hydrateRuntimeState,
  shouldConnectRealtime,
  shouldStartAnalysis,
  shouldTriggerOpening,
} from "./runtime-state";
import { assessTranscriptQuality, isNoiseTranscript } from "./transcript-quality";

describe("Test A — normal startup opening", () => {
  it("triggers opening exactly once on a new interview", () => {
    const first = shouldTriggerOpening({
      openingDelivered: false,
      completed: false,
      isReconnect: false,
      assistantTurnCount: 0,
    });
    const after = shouldTriggerOpening({
      openingDelivered: true,
      completed: false,
      isReconnect: false,
      assistantTurnCount: 1,
    });
    assert.equal(first, true);
    assert.equal(after, false);
  });
});

describe("Test B — reconnect after conversation", () => {
  it("does not greet or ask consent again", () => {
    const state = hydrateRuntimeState(
      {
        openingDelivered: true,
        consentReceived: true,
        phase: "DEEP_DIVE",
        activeProcess: "Prospect research and outreach",
      },
      Array.from({ length: 10 }, (_, index) => ({
        role: index % 2 === 0 ? "assistant" : "user",
        contentText: `turn ${index}`,
      })),
    );
    assert.equal(state.openingDelivered, true);
    assert.equal(state.consentReceived, true);
    assert.equal(
      shouldTriggerOpening({
        openingDelivered: state.openingDelivered,
        completed: false,
        isReconnect: true,
        assistantTurnCount: 5,
      }),
      false,
    );
  });
});

describe("Test C — remount after opening", () => {
  it("keeps openingDelivered and never retriggers", () => {
    markOpeningTriggered("interview-token");
    assert.equal(wasOpeningTriggered("interview-token"), true);
    assert.equal(
      shouldTriggerOpening({
        openingDelivered: true,
        completed: false,
        isReconnect: false,
        assistantTurnCount: 3,
      }),
      false,
    );
  });
});

describe("Test D — duplicate realtime event", () => {
  it("persists a provider event id only once at the same length", () => {
    const token = "dup-token";
    assert.equal(rememberPersistEventId(token, "evt_1"), true);
    assert.equal(rememberPersistEventId(token, "evt_1"), false);
    const plan = planTranscriptUpsert(
      [{ sequenceNo: 1, role: "assistant", contentText: "Բարև", providerEventId: "evt_1" }],
      [
        { role: "assistant", content: "Բարև", providerEventId: "evt_1" },
        { role: "assistant", content: "Բարև", providerEventId: "evt_1" },
      ],
    );
    assert.equal(plan.type, "skip");
  });

  it("posts again when the same provider event id grows", () => {
    const token = "grow-token";
    assert.equal(rememberPersistEventId(token, "evt_grow", 3), true);
    assert.equal(rememberPersistEventId(token, "evt_grow", 3), false);
    assert.equal(rememberPersistEventId(token, "evt_grow", 12), true);
  });
});

describe("Test E / Failure 1 — bad number transcription", () => {
  it("does not record a garbled number as a confirmed fact", () => {
    const transcript = "Մոտավոր օրը տասըրեքուսից հինգահարյուրվաթյունյոթ պատվեր";
    const quality = assessTranscriptQuality(transcript);
    assert.equal(quality.needsClarification, true);
    const decision = decideRecordKeyFact({
      category: "volume",
      value: "10-50/day",
      status: "CONFIRMED",
      rawTranscript: transcript,
      sourceRole: "user",
    });
    assert.equal(decision.record, false);
  });
});

describe("Test E / Failure 2 — mixed-language STT", () => {
  it("rejects Motografen som har անգամ as a volume fact", () => {
    const transcript = "Motografen som har անգամ";
    const quality = assessTranscriptQuality(transcript);
    assert.equal(quality.needsClarification, true);
    const decision = decideRecordKeyFact({
      category: "volume",
      value: "50 contacts/week",
      status: "CONFIRMED",
      rawTranscript: transcript,
      sourceRole: "user",
    });
    assert.equal(decision.record, false);
  });
});

describe("Test F — confirmed number", () => {
  it("records only after the user confirms the assistant's check", () => {
    const before = confirmedUserFactFromExchange({
      assistantAskedConfirmation: true,
      userConfirmed: false,
      proposedValue: "50 per week",
    });
    const after = confirmedUserFactFromExchange({
      assistantAskedConfirmation: true,
      userConfirmed: true,
      proposedValue: "50 per week",
    });
    assert.equal(before.record, false);
    assert.equal(after.record, true);
    assert.equal(after.status, "CONFIRMED");
  });
});

describe("Test G — contradictory metrics", () => {
  it("does not derive FTE when volume, time, and headcount disagree", () => {
    assert.equal(
      laborLooksContradictory({
        weeklyVolume: 50,
        minutesEach: 60,
        people: 5,
      }),
      true,
    );
    const labor = deriveLabor({
      monthlyTransactionsMin: 50 * 4.33,
      monthlyTransactionsMax: 50 * 4.33,
      minutesPerTransactionMin: 60,
      minutesPerTransactionMax: 60,
      contradictory: true,
    });
    assert.equal(labor.fte.min, null);
    assert.equal(labor.hours.min, null);
  });
});

describe("Test H — interruption should not reinit", () => {
  it("never treats a short acknowledgement as a reason to open again", () => {
    assert.equal(
      shouldTriggerOpening({
        openingDelivered: true,
        completed: false,
        isReconnect: false,
        assistantTurnCount: 8,
      }),
      false,
    );
  });
});

describe("Test I — silent tools", () => {
  it("does not treat assistant interpretations as recordable user facts", () => {
    const decision = decideRecordKeyFact({
      category: "volume",
      value: "50/week",
      status: "CONFIRMED",
      rawTranscript: "հա",
      sourceRole: "assistant",
    });
    assert.equal(decision.record, false);
    assert.equal(decision.reason, "ASSISTANT_INFERENCE");
  });
});

describe("Test J — completed interview", () => {
  it("does not reconnect or start analysis automatically", () => {
    assert.equal(shouldConnectRealtime("COMPLETED"), false);
    assert.equal(shouldStartAnalysis("ANALYZED"), false);
    assert.equal(shouldStartAnalysis("COMPLETED"), false);
    assert.equal(shouldStartAnalysis("COMPLETED", true), true);
    assert.equal(shouldStartAnalysis("IN_PROGRESS", true), true);
    assert.equal(shouldStartAnalysis("ANALYZING"), false);
  });
});

describe("Failure 3 — mid-interview short utterance", () => {
  it("continues discovery instead of restarting after many turns", () => {
    const state = hydrateRuntimeState(
      { openingDelivered: true, consentReceived: true, phase: "DISCOVERY" },
      [
        { role: "assistant", contentText: "Հա" },
        { role: "user", contentText: "Hn" },
      ],
    );
    assert.equal(state.openingDelivered, true);
    assert.notEqual(state.phase, "INITIALIZING");
    assert.equal(
      shouldTriggerOpening({
        openingDelivered: state.openingDelivered,
        completed: false,
        isReconnect: false,
        assistantTurnCount: 12,
      }),
      false,
    );
  });
});

describe("derived metrics require confirmed sources", () => {
  it("returns null monthly volume when the source is unreliable", () => {
    const monthly = deriveMonthlyTransactions({
      perDayMin: 10,
      perDayMax: 50,
      reliable: false,
    });
    assert.equal(monthly.min, null);
    assert.equal(monthly.basis, "UNKNOWN");
  });
});

describe("CJK mixed transcript", () => {
  it("flags unexpected script as needing clarification", () => {
    const quality = assessTranscriptQuality("什麼 մեկ աշխատողի");
    assert.equal(quality.needsClarification, true);
    assert.ok(quality.reasons.includes("unexpected_script"));
  });
});

describe("language-locked opening", () => {
  it("speaks Eastern Armenian and uses the given name", () => {
    const text = openingResponseInstructions({ language: "hy", firstName: "ChatGPT" });
    assert.match(text, /Eastern Armenian|արևելահայերեն/);
    assert.match(text, /Բարև, ChatGPT/);
    assert.doesNotMatch(text, /Speak first now, in English/);
  });

  it("uses English only when the interview language is English", () => {
    const text = openingResponseInstructions({ language: "en", firstName: "Alex" });
    assert.match(text, /Hello, Alex/);
    assert.match(text, /in English/);
  });

  it("uses Russian only when the interview language is Russian", () => {
    const text = openingResponseInstructions({ language: "ru", firstName: "Anna" });
    assert.match(text, /Здравствуйте, Anna/);
    assert.match(text, /in Russian/);
    assert.doesNotMatch(text, /Speak first now, in English/);
    assert.doesNotMatch(text, /արևելահայերեն/);
  });
});

describe("noise transcripts do not drive the interview", () => {
  it("ignores junk STT from the production sample without treating Armenian consent as noise", () => {
    for (const sample of ["շ", "Okay", "Okay.", "Levels.", "İleride", "만", "有 Dai spesti", "Stalla hat ja", "Gotcha. Then"]) {
      assert.equal(isNoiseTranscript(sample), true, sample);
    }
    assert.equal(isNoiseTranscript("հա"), false);
    assert.equal(isNoiseTranscript("այո"), false);
    assert.equal(isNoiseTranscript("ոչ"), false);
    assert.equal(isNoiseTranscript("5"), false);
    assert.equal(isNoiseTranscript("երկու հոգի աշխատում է"), false);
    assert.equal(isNoiseTranscript("Администрация"), false);
    assert.equal(isNoiseTranscript("хорошо"), false);
    assert.equal(isNoiseTranscript("да"), false);
  });

  it("does not record a noise transcript as a fact", () => {
    const decision = decideRecordKeyFact({
      category: "people",
      value: "Okay",
      status: "CONFIRMED",
      rawTranscript: "Okay",
      sourceRole: "user",
    });
    assert.equal(decision.record, false);
  });
});
