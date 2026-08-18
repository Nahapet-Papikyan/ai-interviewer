export type TranscriptQuality = {
  suspicious: boolean;
  needsClarification: boolean;
  reasons: string[];
};

const CJK = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/;
const ARABIC = /[\u0600-\u06ff]/;
const THAI = /[\u0e00-\u0e7f]/;
const ARMENIAN = /[\u0530-\u058f]/;
const CYRILLIC = /[\u0400-\u04ff]/;
const LATIN = /[A-Za-z]/;

const ARMENIAN_NUMBER_WORDS = [
  "մեկ",
  "երկու",
  "երեք",
  "չորս",
  "հինգ",
  "վեց",
  "յոթ",
  "ութ",
  "ինը",
  "տասը",
  "տասն",
  "քսան",
  "երեսուն",
  "քառասուն",
  "հիսուն",
  "վաթսուն",
  "յոթանասուն",
  "ութսուն",
  "իննսուն",
  "հարյուր",
  "հազար",
];

const LATIN_FUNCTION_WORDS = /\b(som|har|och|det|att|jag|är|the|and|with|from)\b/i;
  const LATIN_FILLER = /^(ok|okay|gotcha|yes|yeah|yep|no|then|so|levels?|wait|uh|um|hmm|ha|huh|huh\?)\.?$/i;
const ARMENIAN_ACK = /^(հա|հմ|հըմ|հն|այո|ոչ|լավ)\.?$/u;
const RUSSIAN_ACK = /^(да|нет|ага|угу|ок|хорошо|ладно)\.?$/iu;

function uniqueReasons(reasons: string[]) {
  return [...new Set(reasons)];
}

export function assessTranscriptQuality(text: string): TranscriptQuality {
  const reasons: string[] = [];
  const value = text.trim();
  if (!value) {
    return { suspicious: true, needsClarification: true, reasons: ["empty"] };
  }

  if (CJK.test(value) || ARABIC.test(value) || THAI.test(value)) {
    reasons.push("unexpected_script");
  }

  const tokens = value.split(/\s+/);
  if (tokens.some((token) => token.length >= 22 && ARMENIAN.test(token))) {
    reasons.push("run_on_token");
  }

  const jammedNumberWords = ARMENIAN_NUMBER_WORDS.filter((word) => value.includes(word));
  const jammedWithoutSpaces = jammedNumberWords.length >= 3 && !/\s/.test(value.replace(/[^\u0530-\u058f]+/g, "x"));
  if (jammedNumberWords.length >= 4 || jammedWithoutSpaces) {
    reasons.push("number_word_salad");
  }

  const hasArmenian = ARMENIAN.test(value);
  const latinWords = value.match(/[A-Za-z]{3,}/g) ?? [];
  if (hasArmenian && latinWords.length >= 2 && LATIN_FUNCTION_WORDS.test(value)) {
    reasons.push("mixed_unexpected_language");
  }

  if (hasArmenian && latinWords.length >= 3 && value.length < 80) {
    reasons.push("mixed_script_fragment");
  }

  if (hasArmenian && CYRILLIC.test(value) && LATIN.test(value) && value.length < 40) {
    reasons.push("triple_script_fragment");
  }

  const suspicious = reasons.length > 0;
  return {
    suspicious,
    needsClarification: suspicious,
    reasons: uniqueReasons(reasons),
  };
}

export function isNoiseTranscript(text: string): boolean {
  const value = text.trim();
  if (!value) return true;
  if (ARMENIAN_ACK.test(value) || RUSSIAN_ACK.test(value)) return false;
  if (/\d/.test(value) && value.length <= 8 && !CJK.test(value) && !ARABIC.test(value) && !THAI.test(value)) {
    return false;
  }
  if (value.length <= 2) return true;
  if (LATIN_FILLER.test(value)) return true;

  const armenianChars = (value.match(/[\u0530-\u058f]/g) ?? []).length;
  const cyrillicChars = (value.match(/[\u0400-\u04ff]/g) ?? []).length;
  if (armenianChars >= 8) return false;
  if (cyrillicChars >= 4) return false;

  if (CJK.test(value) || ARABIC.test(value) || THAI.test(value)) return true;
  if (!ARMENIAN.test(value) && !CYRILLIC.test(value) && value.length < 16) return true;
  if (!ARMENIAN.test(value) && !CYRILLIC.test(value) && /[A-Za-z]{3,}/.test(value) && value.length < 40) return true;
  if (/^(so|then|gotcha|okay)\b/i.test(value) && armenianChars < 12 && cyrillicChars < 4 && value.length < 28) {
    return true;
  }
  return false;
}

export function looksLikeCriticalNumberUtterance(text: string): boolean {
  const value = text.toLowerCase();
  return (
    /\d/.test(value) ||
    ARMENIAN_NUMBER_WORDS.some((word) => value.includes(word)) ||
    /անգամ|պատվեր|ժամ|րոպե|շաբաթ|օրական|տոկոս|աշխատակից/.test(value)
  );
}

export const CRITICAL_FACT_CATEGORIES = new Set([
  "volume",
  "time",
  "people",
  "system",
  "error",
  "impact",
  "pilot",
]);

export function clarificationHint(text: string): "number" | "system" | "general" {
  if (looksLikeCriticalNumberUtterance(text)) return "number";
  if (/համակարգ|system|erp|crm|1c|excel|sheets|azin|adin/i.test(text)) return "system";
  return "general";
}

export function qualitySystemNote(text: string, quality: TranscriptQuality): string {
  const kind = clarificationHint(text);
  if (kind === "number") {
    return "The latest user transcript looks garbled or numerically uncertain. Ask the respondent to repeat the number, including unit, scope, and period. Do not record or calculate from it.";
  }
  if (kind === "system") {
    return "The latest user transcript has an uncertain system/product name. Ask them to say the name once more. Do not store a guessed name.";
  }
  return `The latest user transcript looks uncertain (${quality.reasons.join(", ") || "unspecified"}). Ask a short clarification. Do not invent a fact from it.`;
}
