import Papa from "papaparse";
import { parseJson, parseStringArray } from "@/lib/json";
import type { Signal } from "@/lib/types";

// Export builders (spec 4.8 Quinable exports + 4.9 Exports/Integrations).
// Supported formats: csv (general), quinable_csv, clay_csv, json.

export type ExportFormat = "csv" | "quinable_csv" | "clay_csv" | "json";

// Loosely-typed candidate-with-relations (as loaded from Prisma with includes).
export type ExportCandidate = {
  id: string;
  name: string;
  website?: string | null;
  organizationType?: string | null;
  parentCompany?: string | null;
  bedCount?: number | null;
  facilityCountEstimate?: number | null;
  npi?: string | null;
  ccn?: string | null;
  priorityTier?: string | null;
  outreachAngle?: string | null;
  recommendedTitles?: string | null;
  painSignals?: string | null;
  riskSignals?: string | null;
  lastVerifiedAt?: Date | null;
  locations?: { address?: string | null; city?: string | null; state?: string | null; postalCode?: string | null; latitude?: number | null; longitude?: number | null }[];
  contacts?: { phone?: string | null }[];
  evidence?: { url?: string | null }[];
  scores?: { fitScore: number; riskScore: number; priorityScore: number; confidence: number }[];
};

function signalsToText(json: string | null | undefined): string {
  const sigs = parseJson<Signal[]>(json, []);
  return sigs.map((s) => s.text || s.type).join(" | ");
}

function evidenceUrls(c: ExportCandidate): string {
  const urls = (c.evidence ?? []).map((e) => e.url).filter(Boolean) as string[];
  return [...new Set(urls)].join(" ");
}

function primaryPhone(c: ExportCandidate): string {
  return (c.contacts ?? []).map((x) => x.phone).find(Boolean) ?? "";
}

function loc(c: ExportCandidate) {
  return (c.locations ?? [])[0] ?? {};
}

function score(c: ExportCandidate) {
  return (c.scores ?? [])[0] ?? { fitScore: 0, riskScore: 0, priorityScore: 0, confidence: 0 };
}

export function buildQuinableRows(candidates: ExportCandidate[]) {
  return candidates.map((c) => {
    const s = score(c);
    const l = loc(c);
    return {
      priority_score: s.priorityScore,
      fit_score: s.fitScore,
      risk_score: s.riskScore,
      confidence: s.confidence,
      name: c.name,
      parent_operator: c.parentCompany ?? "",
      facility_type: c.organizationType ?? "",
      address: l.address ?? "",
      city: l.city ?? "",
      state: l.state ?? "",
      zip: l.postalCode ?? "",
      website: c.website ?? "",
      phone: primaryPhone(c),
      cms_ccn: c.ccn ?? "",
      npi: c.npi ?? "",
      bed_count: c.bedCount ?? "",
      facility_count_estimate: c.facilityCountEstimate ?? "",
      staffing_need_signals: signalsToText(c.painSignals),
      risk_signals: signalsToText(c.riskSignals),
      recommended_decision_maker_titles: parseStringArray(c.recommendedTitles).join(" | "),
      suggested_outreach_angle: c.outreachAngle ?? "",
      evidence_urls: evidenceUrls(c),
      last_verified_at: c.lastVerifiedAt ? new Date(c.lastVerifiedAt).toISOString() : "",
    };
  });
}

export function buildGeneralRows(candidates: ExportCandidate[]) {
  return candidates.map((c) => {
    const s = score(c);
    const l = loc(c);
    return {
      priority_score: s.priorityScore,
      fit_score: s.fitScore,
      risk_score: s.riskScore,
      confidence: s.confidence,
      priority_tier: c.priorityTier ?? "",
      name: c.name,
      organization_type: c.organizationType ?? "",
      website: c.website ?? "",
      phone: primaryPhone(c),
      city: l.city ?? "",
      state: l.state ?? "",
      pain_signals: signalsToText(c.painSignals),
      risk_signals: signalsToText(c.riskSignals),
      suggested_outreach_angle: c.outreachAngle ?? "",
      evidence_urls: evidenceUrls(c),
      last_verified_at: c.lastVerifiedAt ? new Date(c.lastVerifiedAt).toISOString() : "",
    };
  });
}

// Clay-compatible: simple, flat columns Clay can map to enrichment inputs.
export function buildClayRows(candidates: ExportCandidate[]) {
  return candidates.map((c) => {
    const l = loc(c);
    return {
      "Company Name": c.name,
      Domain: c.website ?? "",
      City: l.city ?? "",
      State: l.state ?? "",
      "Priority Score": score(c).priorityScore,
      "Recommended Titles": parseStringArray(c.recommendedTitles).join(", "),
    };
  });
}

export function buildExport(
  format: ExportFormat,
  candidates: ExportCandidate[],
  projectName: string,
): { fileName: string; content: string; rowCount: number; mime: string } {
  const stamp = new Date().toISOString().slice(0, 10);
  const base = projectName.replace(/[^a-z0-9]+/gi, "_").toLowerCase().slice(0, 40);

  if (format === "json") {
    const rows = buildGeneralRows(candidates);
    return { fileName: `${base}_${stamp}.json`, content: JSON.stringify(rows, null, 2), rowCount: rows.length, mime: "application/json" };
  }

  let rows: Record<string, unknown>[];
  let suffix: string;
  if (format === "quinable_csv") {
    rows = buildQuinableRows(candidates);
    suffix = "quinable";
  } else if (format === "clay_csv") {
    rows = buildClayRows(candidates);
    suffix = "clay";
  } else {
    rows = buildGeneralRows(candidates);
    suffix = "candidates";
  }

  const content = Papa.unparse(rows, { header: true });
  return { fileName: `${base}_${suffix}_${stamp}.csv`, content, rowCount: rows.length, mime: "text/csv" };
}
