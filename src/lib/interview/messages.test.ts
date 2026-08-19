import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeTurns, planTranscriptUpsert } from "./messages";

describe("transcript identity upsert", () => {
  it("updates the same providerEventId when later text is longer", () => {
    const plan = planTranscriptUpsert(
      [{ sequenceNo: 1, role: "user", contentText: "ութ", providerEventId: "item_a" }],
      [{ role: "user", content: "ութսուն պատվեր", providerEventId: "item_a" }],
    );
    assert.equal(plan.type, "apply");
    if (plan.type !== "apply") return;
    assert.equal(plan.inserts.length, 0);
    assert.deepEqual(plan.updates, [
      { sequenceNo: 1, contentText: "ութսուն պատվեր", providerEventId: "item_a" },
    ]);
  });

  it("does not overwrite item A text onto item B when completions arrive out of order", () => {
    const first = planTranscriptUpsert([], [
      { role: "user", content: "B second", providerEventId: "item_b" },
    ]);
    assert.equal(first.type, "apply");
    if (first.type !== "apply") return;
    assert.equal(first.inserts[0]?.providerEventId, "item_b");

    const second = planTranscriptUpsert(
      [{ sequenceNo: 1, role: "user", contentText: "B second", providerEventId: "item_b" }],
      [
        { role: "user", content: "A first", providerEventId: "item_a" },
        { role: "user", content: "B second", providerEventId: "item_b" },
      ],
    );
    assert.equal(second.type, "apply");
    if (second.type !== "apply") return;
    assert.equal(second.updates.length, 0);
    assert.equal(second.inserts.length, 1);
    assert.equal(second.inserts[0]?.providerEventId, "item_a");
    assert.equal(second.inserts[0]?.content, "A first");
  });

  it("keeps two consecutive user turns with different item ids", () => {
    const plan = planTranscriptUpsert(
      [{ sequenceNo: 1, role: "assistant", contentText: "Հարց", providerEventId: "asst_1" }],
      [
        { role: "assistant", content: "Հարց", providerEventId: "asst_1" },
        { role: "user", content: "հա", providerEventId: "user_1" },
        { role: "user", content: "80", providerEventId: "user_2" },
      ],
    );
    assert.equal(plan.type, "apply");
    if (plan.type !== "apply") return;
    assert.equal(plan.inserts.length, 2);
    assert.deepEqual(
      plan.inserts.map((turn) => turn.providerEventId),
      ["user_1", "user_2"],
    );
  });

  it("skips an identical payload", () => {
    const plan = planTranscriptUpsert(
      [{ sequenceNo: 1, role: "assistant", contentText: "Բարև", providerEventId: "evt_1" }],
      [
        { role: "assistant", content: "Բարև", providerEventId: "evt_1" },
        { role: "assistant", content: "Բարև", providerEventId: "evt_1" },
      ],
    );
    assert.equal(plan.type, "skip");
  });

  it("does not delete existing rows when incoming history is shorter", () => {
    const plan = planTranscriptUpsert(
      [
        { sequenceNo: 1, role: "assistant", contentText: "Բարև", providerEventId: "a" },
        { sequenceNo: 2, role: "user", contentText: "հա", providerEventId: "b" },
      ],
      [{ role: "assistant", content: "Բարև", providerEventId: "a" }],
    );
    assert.equal(plan.type, "skip");
  });
});

describe("normalizeTurns", () => {
  it("keeps the longest text for a repeated providerEventId", () => {
    const normalized = normalizeTurns([
      { role: "user", content: "ութ", providerEventId: "item_a" },
      { role: "user", content: "ութսուն", providerEventId: "item_a" },
    ]);
    assert.equal(normalized.length, 1);
    assert.equal(normalized[0]?.content, "ութսուն");
  });
});
