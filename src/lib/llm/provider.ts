import { z } from "zod";
import { env } from "@/lib/env";

// Provider-agnostic structured completion. Returns a JSON object validated
// against a Zod schema. Falls back to `null` if the provider is unavailable so
// callers can use deterministic heuristics instead (never hard-fail the scan).

export type LlmMessage = { role: "system" | "user"; content: string };

async function callAnthropic(messages: LlmMessage[]): Promise<string | null> {
  if (!env.anthropicApiKey) return null;
  const system = messages.find((m) => m.role === "system")?.content ?? "";
  const userParts = messages.filter((m) => m.role === "user").map((m) => m.content);
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.anthropicApiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: env.anthropicModel,
      max_tokens: 1500,
      system,
      messages: [{ role: "user", content: userParts.join("\n\n") }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic error ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { content: { type: string; text?: string }[] };
  return data.content?.map((c) => c.text ?? "").join("") ?? null;
}

async function callOpenAI(messages: LlmMessage[]): Promise<string | null> {
  if (!env.openaiApiKey) return null;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.openaiApiKey}`,
    },
    body: JSON.stringify({
      model: env.openaiModel,
      messages,
      response_format: { type: "json_object" },
      temperature: 0,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { choices: { message: { content: string } }[] };
  return data.choices?.[0]?.message?.content ?? null;
}

function extractJson(text: string): unknown {
  // Tolerate code fences / prose around the JSON object.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object in response");
  return JSON.parse(candidate.slice(start, end + 1));
}

/**
 * Run a structured LLM completion. Returns parsed+validated data, or `null`
 * when running in mock mode / no provider configured / repeated failure.
 */
export async function structuredComplete<T>(
  messages: LlmMessage[],
  schema: z.ZodType<T>,
  opts: { maxRetries?: number } = {},
): Promise<T | null> {
  if (env.mockMode || env.llmProvider === "mock") return null;

  const maxRetries = opts.maxRetries ?? 1;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const raw =
        env.llmProvider === "anthropic"
          ? await callAnthropic(messages)
          : await callOpenAI(messages);
      if (!raw) return null;
      const parsed = schema.parse(extractJson(raw));
      return parsed;
    } catch (err) {
      lastErr = err;
    }
  }
  // Bounded retries exhausted — degrade to heuristic path.
  console.warn("[llm] structuredComplete failed, using heuristic fallback:", lastErr);
  return null;
}

export function llmStatus(): { provider: string; live: boolean } {
  const live =
    !env.mockMode &&
    ((env.llmProvider === "anthropic" && !!env.anthropicApiKey) ||
      (env.llmProvider === "openai" && !!env.openaiApiKey));
  return { provider: env.llmProvider, live };
}
