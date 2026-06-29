import { env } from "@/lib/env";
import { normalizeName } from "@/lib/text";

// Embedding abstraction.
//   - "mock" (default): deterministic, offline, hashed bag-of-character-ngrams.
//     Good enough to cluster similar org descriptions for active learning and
//     candidate similarity without any network calls.
//   - "openai": real embeddings via REST when a key is configured.

export const EMBEDDING_DIM = 256;

function tokenize(text: string): string[] {
  const norm = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
  const words = norm.split(/\s+/).filter(Boolean);
  const grams: string[] = [...words];
  // character trigrams capture fuzzy similarity for org names
  for (const w of words) {
    const padded = `#${w}#`;
    for (let i = 0; i < padded.length - 2; i++) {
      grams.push(padded.slice(i, i + 3));
    }
  }
  return grams;
}

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mockEmbed(text: string): number[] {
  const vec = new Array(EMBEDDING_DIM).fill(0);
  const grams = tokenize(text || "");
  if (grams.length === 0) return vec;
  for (const g of grams) {
    const idx = hash(g) % EMBEDDING_DIM;
    const sign = (hash(`${g}:sign`) & 1) === 0 ? 1 : -1;
    vec[idx] += sign;
  }
  // L2 normalize
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

async function openaiEmbed(texts: string[]): Promise<number[][]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.openaiApiKey}`,
    },
    body: JSON.stringify({ model: env.openaiEmbeddingsModel, input: texts }),
  });
  if (!res.ok) {
    throw new Error(`OpenAI embeddings failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { data: { embedding: number[] }[] };
  return data.data.map((d) => d.embedding);
}

export async function embed(text: string): Promise<number[]> {
  if (env.embeddingsProvider === "openai" && env.openaiApiKey && !env.mockMode) {
    try {
      const [v] = await openaiEmbed([text]);
      return v;
    } catch {
      // Fall back to deterministic mock so the pipeline never hard-fails.
      return mockEmbed(text);
    }
  }
  return mockEmbed(text);
}

export async function embedMany(texts: string[]): Promise<number[][]> {
  if (env.embeddingsProvider === "openai" && env.openaiApiKey && !env.mockMode) {
    try {
      return await openaiEmbed(texts);
    } catch {
      return texts.map(mockEmbed);
    }
  }
  return texts.map(mockEmbed);
}

export function cosine(a: number[], b: number[]): number {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export function centroid(vectors: number[][]): number[] | null {
  if (!vectors.length) return null;
  const dim = vectors[0].length;
  const sum = new Array(dim).fill(0);
  for (const v of vectors) {
    for (let i = 0; i < dim; i++) sum[i] += v[i] ?? 0;
  }
  const mean = sum.map((s) => s / vectors.length);
  const norm = Math.sqrt(mean.reduce((s, v) => s + v * v, 0)) || 1;
  return mean.map((v) => v / norm);
}

// Build the canonical text we embed for an org (name + type + description).
export function candidateEmbeddingText(input: {
  name?: string | null;
  organizationType?: string | null;
  description?: string | null;
  services?: string[] | null;
}): string {
  return [
    normalizeName(input.name ?? ""),
    input.organizationType ?? "",
    input.description ?? "",
    (input.services ?? []).join(" "),
  ]
    .filter(Boolean)
    .join(" . ");
}
