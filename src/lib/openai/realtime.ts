import { createHash } from "crypto";
import { realtimeVoice, wireInputAudioConfig } from "@/lib/openai/realtime-config";

export function realtimeSafetyIdentifier(interviewId: string) {
  return createHash("sha256").update(interviewId).digest("hex");
}

export async function mintRealtimeClientSecret(input: {
  instructions: string;
  model: string;
  interviewId: string;
  voice?: string;
  createResponse?: boolean;
  language?: string;
  keywords?: string[];
  interruptResponse?: boolean;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const voice = input.voice || realtimeVoice();
  const audioInput = wireInputAudioConfig({
    createResponse: Boolean(input.createResponse),
    language: input.language,
    keywords: input.keywords,
    interruptResponse: Boolean(input.interruptResponse),
  });
  const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "OpenAI-Safety-Identifier": realtimeSafetyIdentifier(input.interviewId),
    },
    body: JSON.stringify({
      session: {
        type: "realtime",
        model: input.model,
        instructions: input.instructions,
        audio: {
          input: audioInput,
          output: {
            voice,
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to mint realtime token (${response.status}): ${text.slice(0, 400)}`);
  }

  const data = (await response.json()) as { value?: string };
  if (!data.value) {
    throw new Error("Realtime token response missing value");
  }
  return data.value;
}
