export type FeatureName =
  | "FEATURE_MIC_PROCESSING"
  | "FEATURE_NATIVE_INTERRUPT"
  | "FEATURE_DURATION_BUFFER_CLEAR"
  | "FEATURE_TEXT_AGENT"
  | "FEATURE_AUTO_ANALYSIS";

const TRUE = new Set(["1", "true", "yes", "on"]);
const FALSE = new Set(["0", "false", "no", "off"]);

export function parseFeatureFlag(raw: string | undefined, defaultValue = false): boolean {
  const value = raw?.trim().toLowerCase();
  if (!value) return defaultValue;
  if (TRUE.has(value)) return true;
  if (FALSE.has(value)) return false;
  return defaultValue;
}

export function featureFlag(name: FeatureName, defaultValue = false): boolean {
  return parseFeatureFlag(process.env[name], defaultValue);
}

export function interviewFeatureFlags() {
  return {
    micProcessing: featureFlag("FEATURE_MIC_PROCESSING", false),
    nativeInterrupt: featureFlag("FEATURE_NATIVE_INTERRUPT", false),
    durationBufferClear: featureFlag("FEATURE_DURATION_BUFFER_CLEAR", false),
    textAgent: featureFlag("FEATURE_TEXT_AGENT", false),
    autoAnalysis: featureFlag("FEATURE_AUTO_ANALYSIS", false),
  };
}

export type InterviewFeatureFlags = ReturnType<typeof interviewFeatureFlags>;
