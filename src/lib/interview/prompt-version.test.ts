import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "fs";
import path from "path";
import { INTERVIEWER_PROMPT_SOURCE, INTERVIEWER_PROMPT_VERSION } from "../versions";

describe("interviewer prompt v2 wiring", () => {
  it("uses interviewer-v2 and the v2 markdown file", () => {
    assert.equal(INTERVIEWER_PROMPT_VERSION, "interviewer-v2");
    assert.equal(INTERVIEWER_PROMPT_SOURCE, "src/prompts/interviewer.system.v2.md");
    const template = readFileSync(path.join(process.cwd(), INTERVIEWER_PROMPT_SOURCE), "utf8");
    assert.match(template, /{{runtime_state}}/);
    assert.match(template, /Never restart the interview/);
  });
});
