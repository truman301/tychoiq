import { z } from "zod";
import { structuredComplete, type LlmMessage } from "@/lib/llm/provider";
import {
  PAIN_SIGNALS,
  QUALITY_SIGNALS,
  RISK_SIGNALS,
  TRIGGER_SIGNALS,
  COMPETITOR_SIGNALS,
  HOSPITAL_SIGNALS,
  DECISION_MAKER_TITLES,
  findSignals,
  snippetAround,
} from "@/lib/llm/signals";
import type { Signal } from "@/lib/types";

// JSON contract for the extractor (spec 7).
const ExtractionSchema = z.object({
  organizationName: z.string().nullable().optional(),
  organizationType: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  services: z.array(z.string()).default([]),
  decisionMakerTitles: z.array(z.string()).default([]),
  painSignals: z.array(z.object({ type: z.string(), text: z.string() })).default([]),
  qualitySignals: z.array(z.object({ type: z.string(), text: z.string() })).default([]),
  riskSignals: z.array(z.object({ type: z.string(), text: z.string() })).default([]),
  triggerEvents: z.array(z.object({ type: z.string(), text: z.string() })).default([]),
  competitorSignals: z.array(z.object({ type: z.string(), text: z.string() })).default([]),
  hospitalSignals: z.array(z.object({ type: z.string(), text: z.string() })).default([]),
  unsupportedClaims: z.array(z.string()).default([]),
});

export type ExtractionResult = {
  organizationName: string | null;
  organizationType: string | null;
  description: string | null;
  services: string[];
  decisionMakerTitles: string[];
  painSignals: Signal[];
  qualitySignals: Signal[];
  riskSignals: Signal[];
  triggerEvents: Signal[];
  competitorSignals: Signal[];
  hospitalSignals: Signal[];
};

const EXTRACTION_SYSTEM = `You are a precise B2B research analyst extracting structured facts from public web/text.
Rules:
- Extract ONLY what is explicitly supported by the provided text.
- Include NO unsupported facts. If uncertain, omit it.
- Do not infer specific financial condition from vague wording.
- Always preserve a short verbatim snippet ("text") as evidence for each signal.
Return ONLY a JSON object matching the requested shape.`;

function heuristicExtract(
  rawText: string,
  source: { sourceName: string; sourceType: string; url?: string; retrievedAt: string },
): ExtractionResult {
  const text = rawText ?? "";
  const mk = (defs: typeof PAIN_SIGNALS): Signal[] =>
    findSignals(text, defs).map((m) => ({
      type: m.type,
      text: m.matched,
      evidence: {
        sourceName: source.sourceName,
        sourceType: source.sourceType,
        url: source.url,
        retrievedAt: source.retrievedAt,
        snippet: snippetAround(text, m.matched),
        confidence: "medium" as const,
      },
    }));

  // crude services extraction: look for a "services" sentence
  const services = new Set<string>();
  const serviceKeywords = [
    "skilled nursing",
    "assisted living",
    "memory care",
    "rehabilitation",
    "home health",
    "hospice",
    "physical therapy",
    "long-term care",
    "post-acute",
    "respite care",
    "senior living",
  ];
  const lower = text.toLowerCase();
  for (const s of serviceKeywords) if (lower.includes(s)) services.add(s);

  const titles = DECISION_MAKER_TITLES.filter((t) =>
    lower.includes(t.toLowerCase()),
  );

  return {
    organizationName: null,
    organizationType: null,
    description: text ? text.slice(0, 280).replace(/\s+/g, " ").trim() : null,
    services: [...services],
    decisionMakerTitles: titles,
    painSignals: mk(PAIN_SIGNALS),
    qualitySignals: mk(QUALITY_SIGNALS),
    riskSignals: mk(RISK_SIGNALS),
    triggerEvents: mk(TRIGGER_SIGNALS),
    competitorSignals: mk(COMPETITOR_SIGNALS),
    hospitalSignals: mk(HOSPITAL_SIGNALS),
  };
}

/**
 * Extract structured candidate fields from raw source text.
 * Uses the LLM when a live provider is configured; otherwise a deterministic
 * keyword/heuristic extractor. Both paths preserve evidence snippets.
 */
export async function extractCandidateFields(
  rawText: string,
  source: { sourceName: string; sourceType: string; url?: string; retrievedAt: string },
): Promise<ExtractionResult> {
  const heuristic = heuristicExtract(rawText, source);

  const messages: LlmMessage[] = [
    { role: "system", content: EXTRACTION_SYSTEM },
    {
      role: "user",
      content: `Source: ${source.sourceName} (${source.sourceType})\nURL: ${source.url ?? "n/a"}\n\nTEXT:\n${rawText.slice(0, 6000)}`,
    },
  ];
  const llm = await structuredComplete(messages, ExtractionSchema);
  if (!llm) return heuristic;

  const attachEvidence = (
    items: { type: string; text: string }[] | undefined,
  ): Signal[] =>
    (items ?? []).map((s) => ({
      type: s.type,
      text: s.text,
      evidence: {
        sourceName: source.sourceName,
        sourceType: source.sourceType,
        url: source.url,
        retrievedAt: source.retrievedAt,
        snippet: snippetAround(rawText, s.text),
        confidence: "medium" as const,
      },
    }));

  return {
    organizationName: llm.organizationName ?? heuristic.organizationName,
    organizationType: llm.organizationType ?? heuristic.organizationType,
    description: llm.description ?? heuristic.description,
    services: llm.services?.length ? llm.services : heuristic.services,
    decisionMakerTitles: llm.decisionMakerTitles?.length
      ? llm.decisionMakerTitles
      : heuristic.decisionMakerTitles,
    painSignals: attachEvidence(llm.painSignals),
    qualitySignals: attachEvidence(llm.qualitySignals),
    riskSignals: attachEvidence(llm.riskSignals),
    triggerEvents: attachEvidence(llm.triggerEvents),
    competitorSignals: attachEvidence(llm.competitorSignals),
    hospitalSignals: attachEvidence(llm.hospitalSignals),
  };
}
