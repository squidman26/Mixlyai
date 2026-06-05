import { requireEnv, trimEnv } from "./config.js";

const API_URL = "https://api.anthropic.com/v1/messages";

export function requireAnthropicKey() {
  return requireEnv("ANTHROPIC_API_KEY");
}

export function getModel() {
  return trimEnv("ANTHROPIC_MODEL") || "claude-sonnet-4-20250514";
}

export async function chat(messages, systemPrompt) {
  const apiKey = requireAnthropicKey();

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: getModel(),
      max_tokens: 4096,
      system: systemPrompt,
      messages,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  const block = data.content?.find((b) => b.type === "text");
  return block?.text ?? "";
}
