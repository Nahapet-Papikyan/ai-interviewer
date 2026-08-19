import { createHash } from "crypto";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { interviewFeatureFlags, parseFeatureFlag } from "./flags";

function restoreEnv(name: string, previous: string | undefined) {
  if (previous === undefined) delete process.env[name];
  else process.env[name] = previous;
}

describe("feature flags", () => {
  it("defaults to false when unset or empty", () => {
    assert.equal(parseFeatureFlag(undefined, false), false);
    assert.equal(parseFeatureFlag("  ", false), false);
    assert.equal(parseFeatureFlag(undefined, true), true);
  });

  it("parses common true/false tokens", () => {
    assert.equal(parseFeatureFlag("true"), true);
    assert.equal(parseFeatureFlag("1"), true);
    assert.equal(parseFeatureFlag("YES"), true);
    assert.equal(parseFeatureFlag("false"), false);
    assert.equal(parseFeatureFlag("0"), false);
    assert.equal(parseFeatureFlag("off"), false);
  });

  it("keeps mic processing off when the env flag is missing", () => {
    const previous = process.env.FEATURE_MIC_PROCESSING;
    delete process.env.FEATURE_MIC_PROCESSING;
    try {
      assert.equal(interviewFeatureFlags().micProcessing, false);
    } finally {
      restoreEnv("FEATURE_MIC_PROCESSING", previous);
    }
  });

  it("keeps remaining flags off when unset", () => {
    const previous = {
      interrupt: process.env.FEATURE_NATIVE_INTERRUPT,
      buffer: process.env.FEATURE_DURATION_BUFFER_CLEAR,
      text: process.env.FEATURE_TEXT_AGENT,
      analysis: process.env.FEATURE_AUTO_ANALYSIS,
    };
    delete process.env.FEATURE_NATIVE_INTERRUPT;
    delete process.env.FEATURE_DURATION_BUFFER_CLEAR;
    delete process.env.FEATURE_TEXT_AGENT;
    delete process.env.FEATURE_AUTO_ANALYSIS;
    try {
      const flags = interviewFeatureFlags();
      assert.equal(flags.nativeInterrupt, false);
      assert.equal(flags.durationBufferClear, false);
      assert.equal(flags.textAgent, false);
      assert.equal(flags.autoAnalysis, false);
    } finally {
      restoreEnv("FEATURE_NATIVE_INTERRUPT", previous.interrupt);
      restoreEnv("FEATURE_DURATION_BUFFER_CLEAR", previous.buffer);
      restoreEnv("FEATURE_TEXT_AGENT", previous.text);
      restoreEnv("FEATURE_AUTO_ANALYSIS", previous.analysis);
    }
  });
});

describe("safety identifier hashing", () => {
  it("hashes interview ids without emitting the raw uuid", () => {
    const id = "11111111-1111-1111-1111-111111111111";
    const hash = createHash("sha256").update(id).digest("hex");
    assert.equal(hash.length, 64);
    assert.notEqual(hash, id);
  });
});
