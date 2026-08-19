import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildTranscriptionKeywords,
  sanitizeTranscriptionKeyword,
  sdkInputAudioConfig,
  shouldDropAsClick,
  transcriptionLanguages,
  transcriptionPrompt,
  wireInputAudioConfig,
} from "./realtime-config";

describe("transcription languages", () => {
  it("uses languages[] and never language for hy/ru/en", () => {
    assert.deepEqual(transcriptionLanguages("hy"), ["hy", "ru", "en"]);
    assert.deepEqual(transcriptionLanguages("ru"), ["ru", "hy", "en"]);
    assert.deepEqual(transcriptionLanguages("en"), ["en", "hy", "ru"]);

    const hy = wireInputAudioConfig({ createResponse: false, language: "hy" });
    assert.deepEqual(hy.transcription.languages, ["hy", "ru", "en"]);
    assert.equal("language" in hy.transcription, false);
    assert.equal(hy.turn_detection.interrupt_response, false);
    assert.equal("threshold" in hy.turn_detection, false);
    assert.equal("prefix_padding_ms" in hy.turn_detection, false);

    const ru = sdkInputAudioConfig({ createResponse: true, language: "ru", interruptResponse: true });
    assert.deepEqual(ru.transcription.languages, ["ru", "hy", "en"]);
    assert.equal(ru.turnDetection.interruptResponse, true);
    assert.match(transcriptionPrompt("ru"), /Cyrillic/);
    assert.doesNotMatch(transcriptionPrompt("ru"), /Transcribe Armenian speech in Armenian script/);
  });
});

describe("transcription keywords", () => {
  it("includes the company name and strips illegal characters", () => {
    const keywords = buildTranscriptionKeywords(["MegaFood", "Armine", "<ERP>", "Excel\nSheets"]);
    assert.ok(keywords.includes("MegaFood"));
    assert.ok(keywords.includes("Armine"));
    assert.ok(keywords.includes("1C"));
    assert.equal(sanitizeTranscriptionKeyword("A<B>\r\nC"), "A B C");
    assert.equal(sanitizeTranscriptionKeyword("<>"), null);
  });
});

describe("short-speech click heuristic", () => {
  it("classifies sub-350ms bursts without implying audio should be deleted", () => {
    assert.equal(shouldDropAsClick(120), true);
    assert.equal(shouldDropAsClick(350), false);
    assert.equal(shouldDropAsClick(0), false);
  });
});
