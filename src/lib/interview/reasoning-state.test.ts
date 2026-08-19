import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildFactKey, quantityFromFactText } from "./fact-identity";
import {
  deriveLabor,
  deriveMonthlyTransactions,
  deriveWeeklyLaborHours,
  laborTotalsForProcess,
} from "./metrics";
import { parseNumericRange, parseQuantity, quantitiesSemanticallyEqual } from "./quantities";
import { planNextQuestion } from "./question-planner";
import {
  MAX_CLARIFICATION_ATTEMPTS,
  canAskQuestion,
  commitCanonicalFact,
  markQuestionPlanned,
} from "./reasoning-state";
import {
  applyAuthoritativeRuntimeState,
  buildCompactRuntimeUpdate,
  emptyRuntimeState,
} from "./runtime-state";

function deepDiveState() {
  const state = emptyRuntimeState();
  state.phase = "DEEP_DIVE";
  state.openingDelivered = true;
  state.consentReceived = true;
  state.activeProcess = "first_stage_announcements";
  state.lastPlan = {
    questionKey: "volume.first_stage.weekly.whole_team",
    intent: "Ask approximately how many first-stage announcements the whole team processes per week",
    shouldAsk: true,
    reason: "MISSING_FIELD",
    missingSlots: ["number"],
  };
  return state;
}

describe("quantity ranges", () => {
  for (const sample of ["5-20", "5–20", "5 to 20", "5-ից 20", "հինգից քսան"]) {
    it(`parses ${sample} as 5–20`, () => {
      const range = parseNumericRange(sample);
      assert.equal(range.min, 5);
      assert.equal(range.max, 20);
    });
  }

  it("parses an exact value as min=max", () => {
    const range = parseNumericRange("20");
    assert.equal(range.min, 20);
    assert.equal(range.max, 20);
  });

  it("does not collapse a range to the first number in structured parsing", () => {
    const quantity = parseQuantity("5-20 announcements per week");
    assert.equal(quantity.min, 5);
    assert.equal(quantity.max, 20);
    assert.notEqual(quantity.min, quantity.max);
  });

  it("parses մեկուկես ժամ as 1.5 hours", () => {
    const quantity = parseQuantity("մեկուկես ժամ");
    assert.equal(quantity.min, 1.5);
    assert.equal(quantity.max, 1.5);
    assert.equal(quantity.unit, "hour");
    assert.equal(quantity.uncertain, false);
  });

  it("treats մեկ կես ժամ as uncertain", () => {
    const quantity = parseQuantity("մեկ կես ժամ");
    assert.equal(quantity.uncertain, true);
    assert.equal(quantity.min, null);
  });
});

describe("canonical fact identity", () => {
  it("builds volume.first_stage.weekly.whole_team", () => {
    const quantity = quantityFromFactText(
      "5-20",
      "Հա, ամբողջ թիմով շաբաթական մոտ հինգից քսան հայտարարություն։",
      "volume.first_stage.weekly.whole_team",
    );
    assert.equal(buildFactKey({ category: "volume", quantity }), "volume.first_stage.weekly.whole_team");
    assert.equal(quantity.min, 5);
    assert.equal(quantity.max, 20);
    assert.equal(quantity.period, "week");
    assert.equal(quantity.scope, "whole_team");
    assert.equal(quantity.stage, "first_stage");
    assert.equal(quantity.unit, "announcement");
  });

  it("dedupes equivalent Armenian wording into one confirmed fact", () => {
    let state = deepDiveState();
    const first = commitCanonicalFact(state, {
      category: "volume",
      value: "Շաբաթական մոտ 5-ից 20 հայտարարություն ամբողջ թիմի համար առաջին փուլով",
      status: "CONFIRMED",
      rawTranscript: "Շաբաթական մոտ 5-ից 20 հայտարարություն ամբողջ թիմի համար առաջին փուլով",
    });
    state = first.state;
    const second = commitCanonicalFact(state, {
      category: "volume",
      value: "Շաբաթական մոտ 5-ից 20 հայտարարություն, ամբողջ թիմի համար, առաջին փուլում",
      status: "CONFIRMED",
      rawTranscript: "Շաբաթական մոտ 5-ից 20 հայտարարություն, ամբողջ թիմի համար, առաջին փուլում",
    });
    const volumeFacts = second.state.canonicalFacts.filter(
      (fact) => fact.key === "volume.first_stage.weekly.whole_team" && fact.status === "CONFIRMED",
    );
    assert.equal(volumeFacts.length, 1);
    assert.ok(volumeFacts[0].confirmationCount >= 2);
    assert.equal(quantitiesSemanticallyEqual(volumeFacts[0].quantity, first.fact.quantity), true);
  });
});

describe("production volume confirmation regression", () => {
  it("confirms weekly whole-team first-stage volume once and forbids re-asking it", () => {
    let state = deepDiveState();
    state = commitCanonicalFact(state, {
      category: "volume",
      value: "approximately 5–20",
      status: "CONFIRMED",
      rawTranscript: "Մոտավորապես հինգից քսան։",
    }).state;
    const confirmed = commitCanonicalFact(state, {
      category: "volume",
      value: "whole team 5-20 per week first stage",
      status: "CONFIRMED",
      rawTranscript: "Հա, ամբողջ թիմով շաբաթական մոտ հինգից քսան հայտարարություն։",
    });
    state = confirmed.state;
    const fact = state.canonicalFacts.find((item) => item.key === "volume.first_stage.weekly.whole_team");
    assert.ok(fact);
    assert.equal(fact?.status, "CONFIRMED");
    assert.equal(fact?.quantity?.min, 5);
    assert.equal(fact?.quantity?.max, 20);
    assert.equal(fact?.quantity?.period, "week");
    assert.equal(fact?.quantity?.scope, "whole_team");
    assert.equal(fact?.quantity?.stage, "first_stage");
    assert.equal(
      state.canonicalFacts.filter((item) => item.key === "volume.first_stage.weekly.whole_team").length,
      1,
    );
    assert.equal(canAskQuestion(state, "volume.first_stage.weekly.whole_team"), false);
    const next = planNextQuestion(state);
    assert.notEqual(next.questionKey, "volume.first_stage.weekly.whole_team");
    assert.equal(next.shouldAsk, true);
    assert.ok(next.questionKey === "people.first_stage" || next.intent?.includes("people") || next.intent?.includes("մարդ") || Boolean(next.intent));
    assert.notEqual(next.reason, "CLARIFICATION");
  });
});

describe("clarification budget", () => {
  it("clear answers do not require extra confirmation", () => {
    const committed = commitCanonicalFact(deepDiveState(), {
      category: "volume",
      value: "5-20 announcements per week for the whole team in the first stage",
      status: "CONFIRMED",
      rawTranscript: "Հա, ամբողջ թիմով շաբաթական մոտ հինգից քսան հայտարարություն։",
    });
    assert.equal(committed.fact.status, "CONFIRMED");
    const question = committed.state.questionStates.find((item) => item.key === committed.fact.key);
    assert.equal(question?.clarificationCount ?? 0, 0);
    assert.equal(canAskQuestion(committed.state, committed.fact.key), false);
  });

  it("uncertain numeric answers request one then two clarifications, then move on", () => {
    let state = deepDiveState();
    const first = commitCanonicalFact(state, {
      category: "volume",
      value: "unclear",
      status: "UNCERTAIN",
      rawTranscript: "Motografen som har անգամ",
    });
    state = markQuestionPlanned(first.state, planNextQuestion(first.state));
    assert.equal(planNextQuestion(state).reason, "CLARIFICATION");
    assert.equal(state.questionStates.find((item) => item.key === first.fact.key)?.clarificationCount, 1);

    const second = commitCanonicalFact(state, {
      category: "volume",
      value: "still unclear",
      status: "UNCERTAIN",
      rawTranscript: "մեկ կես ժամ",
    });
    state = markQuestionPlanned(second.state, planNextQuestion(second.state));
    assert.equal(state.questionStates.find((item) => item.key === second.fact.key)?.clarificationCount, 2);

    const third = commitCanonicalFact(state, {
      category: "volume",
      value: "still unclear",
      status: "UNCERTAIN",
      rawTranscript: "մեկ կես ժամ",
    });
    state = markQuestionPlanned(third.state, planNextQuestion(third.state));
    const fact = state.canonicalFacts.find((item) => item.key === third.fact.key);
    assert.equal(fact?.status, "UNCERTAIN");
    const question = state.questionStates.find((item) => item.key === third.fact.key);
    assert.ok((question?.clarificationCount ?? 0) >= MAX_CLARIFICATION_ATTEMPTS);
    const next = planNextQuestion(state);
    assert.notEqual(next.reason, "CLARIFICATION");
    assert.notEqual(next.questionKey, third.fact.key);
  });

  it("keeps a confirmed fact unaskable regardless of old clarification count", () => {
    const state = deepDiveState();
    state.questionStates = [
      {
        key: "volume.first_stage.weekly.whole_team",
        status: "CONFIRMED",
        askedCount: 4,
        clarificationCount: 2,
      },
    ];
    const committed = commitCanonicalFact(state, {
      category: "volume",
      value: "5-20 announcements per week whole team first stage",
      status: "CONFIRMED",
      rawTranscript: "Հա, ամբողջ թիմով շաբաթական մոտ հինգից քսան հայտարարություն։",
    });
    assert.equal(canAskQuestion(committed.state, "volume.first_stage.weekly.whole_team"), false);
  });
});

describe("corrections", () => {
  it("does not create a duplicate when the user corrects a confirmed range", () => {
    let state = deepDiveState();
    state = commitCanonicalFact(state, {
      category: "volume",
      value: "5-20 per week whole team first stage announcements",
      status: "CONFIRMED",
      rawTranscript: "շաբաթական 5-20 հայտարարություն ամբողջ թիմ առաջին փուլ",
    }).state;
    const conflicted = commitCanonicalFact(state, {
      category: "volume",
      value: "30-40 per week whole team first stage announcements",
      status: "CONFIRMED",
      rawTranscript: "իրականում շաբաթական 30-40 հայտարարություն ամբողջ թիմ առաջին փուլ",
    });
    assert.equal(conflicted.fact.status, "CONFLICT");
    assert.equal(conflicted.state.canonicalFacts.filter((fact) => fact.key === conflicted.fact.key).length, 1);
    const resolved = commitCanonicalFact(conflicted.state, {
      category: "volume",
      value: "30-40 per week whole team first stage announcements",
      status: "CONFIRMED",
      rawTranscript: "հա, 30-40 շաբաթական ամբողջ թիմ առաջին փուլ հայտարարություն",
    });
    assert.equal(resolved.fact.status, "CONFIRMED");
    assert.equal(resolved.fact.quantity?.min, 30);
    assert.equal(resolved.fact.quantity?.max, 40);
    assert.ok(resolved.fact.previousQuantity);
    assert.equal(resolved.fact.previousQuantity?.min, 5);
  });
});

describe("uncertain to confirmed updates in place", () => {
  it("replaces the canonical UNCERTAIN row instead of adding another", () => {
    let state = deepDiveState();
    state = commitCanonicalFact(state, {
      category: "volume",
      value: "maybe 5-20",
      status: "UNCERTAIN",
      rawTranscript: "մոտավորապես հինգից քսան",
    }).state;
    const confirmed = commitCanonicalFact(state, {
      category: "volume",
      value: "5-20 announcements per week whole team first stage",
      status: "CONFIRMED",
      rawTranscript: "Հա, ամբողջ թիմով շաբաթական մոտ հինգից քսան հայտարարություն։",
    });
    const matches = confirmed.state.canonicalFacts.filter((fact) => fact.key === confirmed.fact.key);
    assert.equal(matches.length, 1);
    assert.equal(matches[0].status, "CONFIRMED");
  });
});

describe("realtime/server runtime synchronization", () => {
  it("applies a newer server runtime and stops planning volume", () => {
    const client = deepDiveState();
    const server = commitCanonicalFact(deepDiveState(), {
      category: "volume",
      value: "5-20 announcements per week whole team first stage",
      status: "CONFIRMED",
      rawTranscript: "Հա, ամբողջ թիմով շաբաթական մոտ հինգից քսան հայտարարություն։",
    }).state;
    server.stateRevision = 4;
    const applied = applyAuthoritativeRuntimeState(client, server);
    assert.equal(applied.stateRevision, 4);
    assert.equal(canAskQuestion(applied, "volume.first_stage.weekly.whole_team"), false);
    assert.notEqual(planNextQuestion(applied).questionKey, "volume.first_stage.weekly.whole_team");
    const compact = buildCompactRuntimeUpdate(applied);
    assert.match(compact, /INTERVIEW STATE UPDATE/);
    assert.match(compact, /volume.first_stage.weekly.whole_team/);
  });

  it("does not replace a newer client revision with an older server payload", () => {
    const current = emptyRuntimeState();
    current.stateRevision = 9;
    const incoming = emptyRuntimeState();
    incoming.stateRevision = 3;
    incoming.phase = "PILOT";
    const applied = applyAuthoritativeRuntimeState(current, incoming);
    assert.equal(applied.stateRevision, 9);
    assert.notEqual(applied.phase, "PILOT");
  });
});

describe("labor range math and partial-stage totals", () => {
  it("keeps 5–20/week × 1.5h through weekly, monthly, and FTE ranges", () => {
    const weeklyHours = deriveWeeklyLaborHours({
      weeklyVolumeMin: 5,
      weeklyVolumeMax: 20,
      hoursEachMin: 1.5,
      hoursEachMax: 1.5,
    });
    assert.equal(weeklyHours.min, 7.5);
    assert.equal(weeklyHours.max, 30);
    const monthly = deriveMonthlyTransactions({
      weeklyMin: 5,
      weeklyMax: 20,
      reliable: true,
    });
    assert.equal(monthly.min, 5 * 4.33);
    assert.equal(monthly.max, 20 * 4.33);
    const labor = deriveLabor({
      monthlyTransactionsMin: monthly.min,
      monthlyTransactionsMax: monthly.max,
      minutesPerTransactionMin: 90,
      minutesPerTransactionMax: 90,
      reliable: true,
    });
    assert.ok(labor.hours.min != null && Math.abs(labor.hours.min - 32.475) < 0.001);
    assert.ok(labor.hours.max != null && Math.abs(labor.hours.max - 129.9) < 0.001);
    assert.ok(labor.fte.min != null && Math.abs(labor.fte.min - 32.475 / 176) < 0.001);
    assert.ok(labor.fte.max != null && Math.abs(labor.fte.max - 129.9 / 176) < 0.001);
  });

  it("does not treat known-stage labor as total process labor", () => {
    const totals = laborTotalsForProcess({
      knownStageHours: { min: 32.475, max: 129.9, pointEstimate: 81.1875 },
      knownStagesOnly: true,
      additionalLaborUnknown: true,
    });
    assert.equal(totals.firstStageLabor.min, 32.475);
    assert.equal(totals.additionalLaborUnknown, true);
    assert.equal(totals.totalLabor.min, null);
    assert.equal(totals.totalLabor.max, null);
  });
});
