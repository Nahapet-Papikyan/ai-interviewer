import { readFileSync } from "fs";
import path from "path";

let interviewerCache: string | null = null;
let analyzerCache: string | null = null;

function readPrompt(filename: string) {
  return readFileSync(path.join(process.cwd(), "src", "prompts", filename), "utf8");
}

export function getInterviewerPromptTemplate() {
  if (process.env.NODE_ENV !== "production") {
    return readPrompt("interviewer.system.md");
  }
  interviewerCache ??= readPrompt("interviewer.system.md");
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

export function buildInterviewerInstructions(ctx: InterviewPromptContext) {
  return getInterviewerPromptTemplate()
    .replaceAll("{{respondent_name}}", ctx.respondentName || "the respondent")
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
    );
}
