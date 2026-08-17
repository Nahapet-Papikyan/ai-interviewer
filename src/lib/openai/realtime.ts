import { realtimeVoice } from "@/lib/openai/realtime-config";

export async function mintRealtimeClientSecret(input: {
  instructions: string;
  model: string;
  voice?: string;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const voice = input.voice || realtimeVoice();
  const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      session: {
        type: "realtime",
        model: input.model,
        instructions: input.instructions,
        audio: {
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
