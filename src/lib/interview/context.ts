import { createHash } from "crypto";
import { readFileSync } from "fs";
import path from "path";
import { buildRuntimeStatePrompt, type InterviewRuntimeState } from "@/lib/interview/runtime-state";
import { INTERVIEWER_PROMPT_SOURCE, INTERVIEWER_PROMPT_VERSION } from "@/lib/versions";

let interviewerCache: string | null = null;
let analyzerCache: string | null = null;

function readPrompt(filename: string) {
  return readFileSync(path.join(process.cwd(), "src", "prompts", filename), "utf8");
}

export function getInterviewerPromptTemplate() {
  if (process.env.NODE_ENV !== "production") {
    return readPrompt("interviewer.system.v2.md");
  }
  interviewerCache ??= readPrompt("interviewer.system.v2.md");
  return interviewerCache;
}

export function getAnalyzerPrompt() {
  analyzerCache ??= readPrompt("analyzer.system.md");
  return analyzerCache;
}

export type InterviewPromptContext = {
  respondentName: string;
  respondentRole: string;
  preferredLanguage: string;
  companyName: string;
  vertical: string;
  verifiedFacts: string[];
  hypotheses: string[];
  respondentNameHy?: string;
  runtimeState?: InterviewRuntimeState;
};

export function languageLabel(code: string) {
  const value = (code || "").toLowerCase();
  if (!value || value === "hy" || value.startsWith("hy")) {
    return "Eastern Armenian (արևելահայերեն), Republic of Armenia / Yerevan standard";
  }
  if (value === "ru" || value.startsWith("ru")) return "Russian";
  if (value === "en" || value.startsWith("en")) return "English";
  return code;
}

export function interviewerPromptMeta(template = getInterviewerPromptTemplate()) {
  return {
    version: INTERVIEWER_PROMPT_VERSION,
    source: INTERVIEWER_PROMPT_SOURCE,
    hash: createHash("sha256").update(template).digest("hex").slice(0, 16),
  };
}

export function buildInterviewerInstructions(ctx: InterviewPromptContext) {
  const spokenName = ctx.respondentNameHy || ctx.respondentName || "the respondent";
  const runtime = ctx.runtimeState
    ? buildRuntimeStatePrompt(ctx.runtimeState)
    : "INTERVIEW RUNTIME STATE\nOpening delivered: no\nConsent received: no";
  return getInterviewerPromptTemplate()
    .replaceAll("{{respondent_name}}", ctx.respondentName || "the respondent")
    .replaceAll("{{respondent_name_hy}}", spokenName)
    .replaceAll("{{respondent_role}}", ctx.respondentRole || "unknown")
    .replaceAll("{{preferred_language}}", languageLabel(ctx.preferredLanguage))
    .replaceAll("{{company_name}}", ctx.companyName)
    .replaceAll("{{vertical}}", ctx.vertical)
    .replaceAll(
      "{{verified_company_facts}}",
      ctx.verifiedFacts.length ? ctx.verifiedFacts.map((f) => `- ${f}`).join("\n") : "- none supplied",
    )
    .replaceAll(
      "{{company_hypotheses}}",
      ctx.hypotheses.length ? ctx.hypotheses.map((h) => `- ${h}`).join("\n") : "- none supplied",
    )
    .replaceAll("{{runtime_state}}", runtime);
}
