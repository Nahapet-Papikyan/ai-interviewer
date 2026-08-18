import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isBenignRealtimeError, previewText, summarizeUnknownError } from "./logging";

describe("interview log helpers", () => {
  it("summarizes Error and nested realtime error objects", () => {
    assert.deepEqual(summarizeUnknownError(new TypeError("boom")), {
      name: "TypeError",
      message: "boom",
    });
    assert.equal(
      summarizeUnknownError({
        type: "error",
        error: { type: "invalid_request_error", code: "session_expired", message: "Session expired" },
      }).code,
      "session_expired",
    );
  });

  it("treats response_cancel_not_active as a non-fatal realtime error", () => {
    assert.equal(
      isBenignRealtimeError({
        type: "error",
        error: {
          type: "invalid_request_error",
          code: "response_cancel_not_active",
          message: "Cancellation failed: no active response found",
        },
      }),
      true,
    );
    assert.equal(isBenignRealtimeError(new Error("WebRTC disconnected")), false);
  });

  it("keeps short STT previews and truncates long ones", () => {
    assert.equal(previewText("Okay"), "Okay");
    assert.equal(previewText("x".repeat(60)).endsWith("…"), true);
  });
});
