// Deterministic signal dictionaries used by the heuristic extractor (mock mode)
// and to enrich LLM output. Each match carries the matched phrase so we can keep
// an evidence snippet — never an unsupported claim.

export type SignalDef = { type: string; keywords: string[] };

export const PAIN_SIGNALS: SignalDef[] = [
  { type: "hiring_clinical", keywords: ["hiring cna", "hiring cnas", "hiring lpn", "hiring rn", "now hiring", "caregivers wanted", "join our team", "hiring caregivers", "hiring hha"] },
  { type: "weekend_staffing", keywords: ["weekend staffing", "weekend coverage", "weekend shift"] },
  { type: "agency_reduction", keywords: ["reduce agency", "agency staffing", "contract labor", "agency spend"] },
  { type: "call_off_coverage", keywords: ["call off", "call-off", "call offs", "shift coverage", "open shifts"] },
  { type: "open_roles", keywords: ["careers", "we are hiring", "open positions", "job openings", "apply now"] },
  { type: "expansion", keywords: ["now open", "newly opened", "expanding", "new location", "grand opening"] },
];

export const QUALITY_SIGNALS: SignalDef[] = [
  { type: "multi_site", keywords: ["our locations", "multiple locations", "communities", "facilities across", "locations in", "family of communities"] },
  { type: "professional_operator", keywords: ["our mission", "leadership team", "our team", "accredited", "award", "5-star", "5 star", "deficiency-free"] },
  { type: "compliance_orientation", keywords: ["medicare certified", "medicaid certified", "licensed", "compliance", "joint commission", "chap accredited"] },
  { type: "operational_maturity", keywords: ["electronic health record", "ehr", "quality program", "infection control", "training program"] },
];

export const RISK_SIGNALS: SignalDef[] = [
  { type: "financial_distress", keywords: ["receivership", "bankruptcy", "chapter 11", "chapter 7", "insolvency", "foreclosure"] },
  { type: "payment_risk", keywords: ["nonpayment", "non-payment", "payment dispute", "unpaid", "collections lawsuit", "owes"] },
  { type: "regulatory_risk", keywords: ["civil monetary penalty", "license revoked", "immediate jeopardy", "termination notice", "special focus facility"] },
  { type: "closure", keywords: ["permanently closed", "facility closed", "ceased operations", "shutting down", "closure"] },
  { type: "ownership_instability", keywords: ["ownership change", "new ownership", "sold to", "change of ownership"] },
];

export const TRIGGER_SIGNALS: SignalDef[] = [
  { type: "leadership_change", keywords: ["new administrator", "new executive director", "appointed", "promoted to"] },
  { type: "funding_or_acquisition", keywords: ["acquired", "acquisition", "merger", "funding", "investment"] },
  { type: "new_facility", keywords: ["new facility", "now open", "opening soon", "ribbon cutting"] },
];

export const COMPETITOR_SIGNALS: SignalDef[] = [
  { type: "staffing_agency", keywords: ["staffing agency", "travel nurse", "travel nursing", "per diem agency", "nurse staffing agency", "we staff", "staffing solutions"] },
];

export const HOSPITAL_SIGNALS: SignalDef[] = [
  { type: "hospital", keywords: ["medical center", "regional hospital", "general hospital", "emergency department", "emergency room", "level i trauma", "acute care hospital"] },
];

export const DECISION_MAKER_TITLES = [
  "Administrator",
  "Executive Director",
  "Director of Nursing",
  "DON",
  "Staffing Coordinator",
  "Scheduler",
  "VP of Operations",
  "Chief Operating Officer",
  "Regional Director",
  "Owner",
  "HR Director",
  "Talent Acquisition",
];

export function findSignals(
  text: string,
  defs: SignalDef[],
): { type: string; matched: string }[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const found: { type: string; matched: string }[] = [];
  const seen = new Set<string>();
  for (const def of defs) {
    for (const kw of def.keywords) {
      if (lower.includes(kw) && !seen.has(def.type)) {
        found.push({ type: def.type, matched: kw });
        seen.add(def.type);
        break;
      }
    }
  }
  return found;
}

// Pull a short snippet around the first occurrence of a phrase for evidence.
export function snippetAround(text: string, phrase: string, radius = 90): string {
  const idx = text.toLowerCase().indexOf(phrase.toLowerCase());
  if (idx === -1) return text.slice(0, radius * 2).trim();
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + phrase.length + radius);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}
