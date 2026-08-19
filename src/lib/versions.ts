export const INTERVIEWER_PROMPT_VERSION = "interviewer-v2";
export const INTERVIEWER_PROMPT_SOURCE = "src/prompts/interviewer.system.v2.md";
export const ANALYZER_PROMPT_VERSION = "analyzer-v1";
export const ANALYSIS_SCHEMA_VERSION = "analysis-schema-v2";

export const FTE_HOURS_PER_MONTH = Number(
  process.env.FTE_HOURS_PER_MONTH ?? 176,
);
export const WORKING_DAYS_PER_MONTH = 22;
export const WEEKS_PER_MONTH = 4.33;
