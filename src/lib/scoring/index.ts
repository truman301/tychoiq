import type {
  CandidateScoreResult,
  Contact,
  GeoLocation,
  IcpData,
  ScoringWeights,
  Signal,
} from "@/lib/types";
import { clamp } from "@/lib/utils";
import { weightsForMode } from "@/lib/scoring/weights";

// ----------------------------------------------------------------------------
// Deterministic, auditable scoring engine (spec 4.7 / 4.8).
//
// Every fit/risk component returns a fraction in [0,1] plus optional reason and
// "missing info" notes. Component fractions are multiplied by their configured
// weight (weights sum to 100), so fitScore/riskScore land in [0,100] directly.
// LLMs are NOT used to produce the number — they only extract the structured
// signals this engine consumes, keeping scoring visible and reproducible.
// ----------------------------------------------------------------------------

export type ScoringCandidate = {
  name?: string | null;
  organizationType?: string | null;
  website?: string | null;
  domain?: string | null;
  description?: string | null;
  services?: string[] | null;
  locations?: GeoLocation[] | null;
  state?: string | null;
  facilityCountEstimate?: number | null;
  employeeCountEstimate?: number | null;
  bedCount?: number | null;
  starRating?: number | null;
  contacts?: Contact[] | null;
  painSignals?: Signal[] | null;
  qualitySignals?: Signal[] | null;
  riskSignals?: Signal[] | null;
  triggerEvents?: Signal[] | null;
  competitorSignals?: Signal[] | null;
  hospitalSignals?: Signal[] | null;
};

export type ScoringContext = {
  mode: string;
  icp: IcpData;
  weights?: ScoringWeights;
  distinctSourceCount: number;
  hasAuthoritativeDatasetEvidence?: boolean;
};

type Comp = { value: number; reason?: string; avoid?: string; missing?: string };

function lc(s?: string | null): string {
  return (s ?? "").toLowerCase();
}

function signalText(sigs?: Signal[] | null, max = 1): string {
  if (!sigs?.length) return "";
  return sigs
    .slice(0, max)
    .map((s) => s.evidence?.snippet || s.text)
    .join("; ");
}

function candidateState(c: ScoringCandidate): string | null {
  if (c.state) return c.state.toUpperCase();
  const loc = (c.locations ?? []).find((l) => l.state)?.state;
  return loc ? loc.toUpperCase() : null;
}

function locationCount(c: ScoringCandidate): number | null {
  if (typeof c.facilityCountEstimate === "number") return c.facilityCountEstimate;
  if (c.locations && c.locations.length > 0) return c.locations.length;
  return null;
}

// --- category / facility type fit -------------------------------------------
function categoryFit(c: ScoringCandidate, icp: IcpData): Comp {
  const hay = [lc(c.organizationType), lc(c.name), (c.services ?? []).join(" ").toLowerCase(), lc(c.description)].join(" ");

  const excluded = icp.organizationTypesExclude.find((t) => t && hay.includes(t.toLowerCase()));
  const isHospital = (c.hospitalSignals ?? []).length > 0;
  const isCompetitor = (c.competitorSignals ?? []).length > 0;
  if (excluded || isHospital || isCompetitor) {
    return {
      value: 0,
      avoid: excluded
        ? `Matches excluded category "${excluded}"`
        : isHospital
          ? "Appears to be a hospital (out of target category)"
          : "Appears to be a staffing agency / competitor",
    };
  }

  const matchedInclude = icp.organizationTypesInclude.find((t) => t && hay.includes(t.toLowerCase()));
  if (matchedInclude) {
    return { value: 1, reason: `In target category: ${matchedInclude}` };
  }
  const matchedOptional = icp.optionalCategories.find((t) => t && hay.includes(t.toLowerCase()));
  if (matchedOptional) return { value: 0.65, reason: `Adjacent category: ${matchedOptional}` };

  if ((c.services ?? []).length > 0) return { value: 0.4, missing: "Category not clearly confirmed" };
  return { value: 0.25, missing: "Organization category unknown" };
}

// --- geography ---------------------------------------------------------------
function geographyFit(c: ScoringCandidate, icp: IcpData): Comp {
  const st = candidateState(c);
  const states = (icp.geography.states ?? []).map((s) => s.toUpperCase());
  const hasGeo = states.length > 0 || (icp.geography.cities ?? []).length > 0 || (icp.geography.zips ?? []).length > 0;
  if (!hasGeo) return { value: 0.6, missing: "No target geography defined in ICP" };
  if (!st) return { value: 0.4, missing: "Candidate location/state unknown" };
  if (states.includes(st)) return { value: 1, reason: `Located in target state ${st}` };
  // city/zip match
  const city = lc((c.locations ?? []).find((l) => l.city)?.city);
  if (city && (icp.geography.cities ?? []).some((cc) => lc(cc) === city)) {
    return { value: 1, reason: `Located in target city` };
  }
  return { value: 0.1, avoid: `Outside target geography (${st})` };
}

// --- size --------------------------------------------------------------------
function sizeFit(c: ScoringCandidate, icp: IcpData): Comp {
  const locs = locationCount(c);
  const emp = c.employeeCountEstimate ?? null;
  const s = icp.sizeSignals;
  if (locs == null && emp == null) return { value: 0.5, missing: "Size signals (locations/employees) unknown" };

  let value = 1;
  let note: string | undefined;
  if (locs != null) {
    if (s.minLocations != null && locs < s.minLocations) {
      value = 0.4;
      note = `Below preferred location count (${locs})`;
    }
    if (s.maxLocations != null && locs > s.maxLocations) {
      value = Math.min(value, 0.5);
      note = `Above preferred size (${locs} locations)`;
    }
  }
  if (emp != null) {
    if (s.minEmployees != null && emp < s.minEmployees) {
      value = Math.min(value, 0.4);
      note = `Below minimum employees (${emp})`;
    }
    if (s.maxEmployees != null && emp > s.maxEmployees) {
      value = Math.min(value, 0.5);
      note = `Above maximum employees (${emp})`;
    }
  }
  return value >= 1
    ? { value: 1, reason: "Within target size band" }
    : { value, missing: note };
}

// --- pain / staffing need ----------------------------------------------------
function painStrength(c: ScoringCandidate): Comp {
  const pains = c.painSignals ?? [];
  if (pains.length === 0) return { value: 0, missing: "No pain/staffing-need signals found" };
  const value = clamp(pains.length / 3, 0, 1);
  return { value, reason: `Pain/staffing signal: ${signalText(pains)}` };
}

// --- timing / trigger --------------------------------------------------------
function triggerStrength(c: ScoringCandidate): Comp {
  const trg = c.triggerEvents ?? [];
  if (trg.length === 0) return { value: 0.1 };
  return { value: clamp(trg.length / 2, 0, 1), reason: `Trigger event: ${signalText(trg)}` };
}

// --- decision maker ----------------------------------------------------------
function decisionMakerQuality(c: ScoringCandidate, icp: IcpData): Comp {
  const contacts = c.contacts ?? [];
  const named = contacts.filter((x) => x.name);
  if (named.length > 0) {
    return { value: 1, reason: `Identified decision maker: ${named[0].title ?? named[0].name}` };
  }
  const titles = contacts.filter((x) => x.title);
  if (titles.length > 0) return { value: 0.6, reason: `Relevant titles present: ${titles[0].title}` };
  if (icp.buyerPersonaTitles.length > 0) return { value: 0.2, missing: "No decision maker identified yet" };
  return { value: 0.4 };
}

// --- expansion / multi-location ---------------------------------------------
function expansionPotential(c: ScoringCandidate): Comp {
  const locs = locationCount(c);
  const multiSite = (c.qualitySignals ?? []).some((s) => s.type === "multi_site");
  if ((locs ?? 0) > 1 || multiSite) return { value: 1, reason: "Multi-location / expansion potential" };
  if (locs === 1) return { value: 0.3, missing: "Appears single-location" };
  return { value: 0.4, missing: "Multi-location potential unknown" };
}

// --- evidence quality --------------------------------------------------------
function evidenceQuality(ctx: ScoringContext): Comp {
  const n = ctx.distinctSourceCount;
  if (ctx.hasAuthoritativeDatasetEvidence && n >= 1) return { value: 1, reason: "Authoritative dataset + corroborating source" };
  if (n >= 2) return { value: 1, reason: `${n} independent evidence sources` };
  if (n === 1) return { value: 0.5, missing: "Only one evidence source" };
  return { value: 0, missing: "No evidence sources attached" };
}

// --- quinable specific helpers ----------------------------------------------
function paymentQualityProxy(c: ScoringCandidate): Comp {
  const hasPaymentRisk = (c.riskSignals ?? []).some((s) => s.type === "payment_risk" || s.type === "financial_distress");
  if (hasPaymentRisk) return { value: 0.1, avoid: "Payment / financial risk signal present" };
  const professional = (c.qualitySignals ?? []).some((s) => s.type === "professional_operator" || s.type === "compliance_orientation");
  if (professional) return { value: 1, reason: "Professional operator / payment-quality proxy positive" };
  return { value: 0.5, missing: "Payment quality unknown (no AP/operator signals)" };
}

function complianceMaturity(c: ScoringCandidate): Comp {
  const compliance = (c.qualitySignals ?? []).some((s) => s.type === "compliance_orientation" || s.type === "operational_maturity");
  if (typeof c.starRating === "number") {
    if (c.starRating >= 4) return { value: 1, reason: `Strong quality rating (${c.starRating}★)` };
    if (c.starRating <= 2) return { value: 0.2, missing: `Low quality rating (${c.starRating}★)` };
    return { value: 0.6, reason: `Moderate quality rating (${c.starRating}★)` };
  }
  if (compliance) return { value: 0.9, reason: "Compliance / operational maturity signals present" };
  return { value: 0.5, missing: "Compliance/operational maturity unknown" };
}

function repeatVolumePotential(c: ScoringCandidate): Comp {
  const beds = c.bedCount ?? null;
  if (beds != null) {
    if (beds >= 80) return { value: 1, reason: `Large facility (${beds} beds) → high repeat volume` };
    if (beds >= 40) return { value: 0.7, reason: `Mid-size facility (${beds} beds)` };
    return { value: 0.4, missing: `Small facility (${beds} beds)` };
  }
  const locs = locationCount(c);
  if ((locs ?? 0) > 1) return { value: 0.8, reason: "Multiple sites → recurring volume" };
  return { value: 0.5, missing: "Repeat-volume potential unknown (no bed count)" };
}

// --- risk components ---------------------------------------------------------
function riskFromSignals(c: ScoringCandidate, types: string[], label: string): Comp {
  const sigs = (c.riskSignals ?? []).filter((s) => types.includes(s.type));
  if (sigs.length === 0) return { value: 0 };
  return { value: clamp(0.6 + 0.2 * sigs.length, 0, 1), avoid: `${label}: ${signalText(sigs)}` };
}

function poorDataQuality(ctx: ScoringContext): Comp {
  if (ctx.distinctSourceCount === 0) return { value: 1, avoid: "No corroborating evidence sources" };
  if (ctx.distinctSourceCount === 1) return { value: 0.4, avoid: "Thin evidence (single source)" };
  return { value: 0 };
}

function tooSmallOrOneOff(c: ScoringCandidate, icp: IcpData): Comp {
  const locs = locationCount(c);
  if (locs === 1 && (c.painSignals ?? []).length === 0) {
    return { value: 0.5, avoid: "Single small site with no repeat-volume signal" };
  }
  const emp = c.employeeCountEstimate;
  if (emp != null && icp.sizeSignals.minEmployees != null && emp < icp.sizeSignals.minEmployees / 2) {
    return { value: 0.7, avoid: `Much smaller than target (${emp} employees)` };
  }
  return { value: 0 };
}

function competitorConflict(c: ScoringCandidate): Comp {
  if ((c.competitorSignals ?? []).length > 0) return { value: 1, avoid: "Competitor / staffing agency" };
  return { value: 0 };
}

function userDefinedRisks(c: ScoringCandidate, icp: IcpData): Comp {
  const hay = `${lc(c.description)} ${signalText(c.riskSignals, 5)}`.toLowerCase();
  const matched = icp.riskSignals.find((r) => r && hay.includes(r.toLowerCase()));
  if (matched) return { value: 0.8, avoid: `Matches ICP risk criterion "${matched}"` };
  return { value: 0 };
}

// ----------------------------------------------------------------------------
// Component routing tables (key -> scorer). Allows the configured weights to
// drive exactly which components are evaluated.
// ----------------------------------------------------------------------------
function fitComponent(key: string, c: ScoringCandidate, ctx: ScoringContext): Comp {
  switch (key) {
    case "category_fit":
    case "facility_type_fit":
      return categoryFit(c, ctx.icp);
    case "geography_fit":
    case "geography_density_fit":
      return geographyFit(c, ctx.icp);
    case "size_fit":
      return sizeFit(c, ctx.icp);
    case "pain_signal_strength":
    case "staffing_need_signal":
      return painStrength(c);
    case "timing_or_trigger_strength":
      return triggerStrength(c);
    case "decision_maker_quality":
      return decisionMakerQuality(c, ctx.icp);
    case "expansion_potential":
    case "multi_location_expansion":
      return expansionPotential(c);
    case "repeat_volume_potential":
      return repeatVolumePotential(c);
    case "payment_quality_proxy":
      return paymentQualityProxy(c);
    case "compliance_and_operational_maturity":
      return complianceMaturity(c);
    case "evidence_quality":
      return evidenceQuality(ctx);
    case "confidence_adjustment":
      return { value: 0.6 }; // folded into confidence; small smoothing weight
    default:
      return { value: 0.5 };
  }
}

function riskComponent(key: string, c: ScoringCandidate, ctx: ScoringContext): Comp {
  switch (key) {
    case "financial_distress":
    case "financial_distress_or_receivership":
      return riskFromSignals(c, ["financial_distress", "closure"], "Financial distress");
    case "regulatory_or_legal_risk":
    case "severe_regulatory_risk":
      return riskFromSignals(c, ["regulatory_risk"], "Regulatory/legal risk");
    case "bad_customer_signals":
    case "payment_risk_signal":
      return riskFromSignals(c, ["payment_risk"], "Payment risk");
    case "poor_data_quality":
    case "duplicate_or_bad_data":
      return poorDataQuality(ctx);
    case "wrong_size_or_one_off":
    case "too_small_or_one_off":
      return tooSmallOrOneOff(c, ctx.icp);
    case "competitor_or_conflict":
      return competitorConflict(c);
    case "poor_operational_maturity": {
      const m = complianceMaturity(c);
      // invert: poor maturity is risky
      return m.value <= 0.3 ? { value: 0.7, avoid: m.missing ?? "Poor operational maturity" } : { value: 0 };
    }
    case "user_defined_risks":
      return userDefinedRisks(c, ctx.icp);
    default:
      return { value: 0 };
  }
}

export function scoreCandidate(c: ScoringCandidate, ctx: ScoringContext): CandidateScoreResult {
  const weights = ctx.weights ?? weightsForMode(ctx.mode);
  const breakdown: Record<string, number> = {};
  const reasonsToTarget: string[] = [];
  const reasonsToAvoid: string[] = [];
  const missingInfo: string[] = [];

  let fitScore = 0;
  for (const [key, weight] of Object.entries(weights.fit)) {
    const comp = fitComponent(key, c, ctx);
    const contribution = comp.value * weight;
    breakdown[`fit.${key}`] = Math.round(contribution * 10) / 10;
    fitScore += contribution;
    if (comp.reason && comp.value >= 0.6) reasonsToTarget.push(comp.reason);
    if (comp.missing) missingInfo.push(comp.missing);
    if (comp.avoid) reasonsToAvoid.push(comp.avoid);
  }

  let riskScore = 0;
  for (const [key, weight] of Object.entries(weights.risk)) {
    const comp = riskComponent(key, c, ctx);
    const contribution = comp.value * weight;
    breakdown[`risk.${key}`] = Math.round(contribution * 10) / 10;
    riskScore += contribution;
    if (comp.avoid && comp.value >= 0.4) reasonsToAvoid.push(comp.avoid);
  }

  fitScore = clamp(Math.round(fitScore), 0, 100);
  riskScore = clamp(Math.round(riskScore), 0, 100);

  // Strategic boost: rewards expansion potential + active triggers (capped).
  const expansion = expansionPotential(c).value;
  const trigger = triggerStrength(c).value;
  const strategicBoost = clamp(Math.round(expansion * 6 + trigger * 4), 0, 10);
  const priorityScore = clamp(Math.round(fitScore - 0.5 * riskScore + strategicBoost), 0, 100);

  // Confidence: evidence breadth + populated key fields.
  const keyFields = [
    c.website,
    candidateState(c),
    c.organizationType,
    (c.services ?? []).length ? "services" : null,
    (c.painSignals ?? []).length ? "pain" : null,
    locationCount(c) != null ? "size" : null,
  ];
  const populated = keyFields.filter(Boolean).length / keyFields.length;
  const sourceConf = ctx.distinctSourceCount >= 2 ? 0.85 : ctx.distinctSourceCount === 1 ? 0.6 : 0.3;
  const confidence = clamp(0.5 * sourceConf + 0.5 * populated, 0.1, 0.98);

  // --- tier calibration (spec 4.7) + Candidate Quality Gate (spec 9) ---------
  const hasExclusion = reasonsToAvoid.some((r) =>
    /excluded category|hospital|competitor|staffing agency/i.test(r),
  );
  let priorityTier: CandidateScoreResult["priorityTier"];
  if (riskScore >= 70 || hasExclusion) priorityTier = "avoid";
  else if (priorityScore >= 80 && riskScore < 35) priorityTier = "high";
  else if (priorityScore >= 60) priorityTier = "medium";
  else if (priorityScore >= 40) priorityTier = "low";
  else priorityTier = "low";

  // Quality gate: cannot be "high" without 2 independent sources (or 1
  // authoritative dataset + website), category+geography evidence, confidence>=0.70.
  if (priorityTier === "high") {
    const hasCategoryEvidence = breakdown["fit.category_fit"] >= 12 || breakdown["fit.facility_type_fit"] >= 9;
    const hasGeoEvidence = breakdown["fit.geography_fit"] >= 6 || breakdown["fit.geography_density_fit"] >= 6;
    const enoughSources =
      ctx.distinctSourceCount >= 2 || (ctx.hasAuthoritativeDatasetEvidence && !!c.website);
    if (!(hasCategoryEvidence && hasGeoEvidence && enoughSources && confidence >= 0.7)) {
      priorityTier = "medium";
      missingInfo.push("Quality gate: needs ≥2 independent sources + category/geography evidence for High tier");
    }
  }

  // recommended next action
  let recommendedNextAction: CandidateScoreResult["recommendedNextAction"];
  if (priorityTier === "avoid") recommendedNextAction = "skip";
  else if (confidence < 0.55 || missingInfo.length >= 4) recommendedNextAction = "research";
  else if (priorityTier === "high") recommendedNextAction = "export";
  else if (priorityTier === "medium") recommendedNextAction = "label";
  else recommendedNextAction = "watch";

  return {
    fitScore,
    riskScore,
    priorityScore,
    confidence: Math.round(confidence * 100) / 100,
    scoreBreakdown: breakdown,
    topReasonsToTarget: dedupe(reasonsToTarget).slice(0, 5),
    topReasonsToAvoid: dedupe(reasonsToAvoid).slice(0, 5),
    missingInfo: dedupe(missingInfo).slice(0, 6),
    recommendedNextAction,
    priorityTier,
  };
}

function dedupe(arr: string[]): string[] {
  return [...new Set(arr.filter(Boolean))];
}
