// Shared domain types (mirror the spec's TypeScript contracts).

export type Confidence = "low" | "medium" | "high";

export type Evidence = {
  sourceName: string;
  sourceType: string;
  url?: string;
  retrievedAt: string;
  snippet?: string;
  confidence: Confidence;
  field?: string;
};

export type Signal = {
  type: string;
  text: string;
  evidence?: Evidence;
};

export type GeoLocation = {
  label?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  isHeadquarters?: boolean;
};

export type Contact = {
  name?: string;
  title?: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  source?: string;
  confidence?: Confidence;
};

// Normalized connector output (spec 4.4).
export type RawSourceRecord = {
  sourceType: string;
  sourceName: string;
  sourceUrl?: string;
  retrievedAt: string;
  rawTitle?: string;
  rawText?: string;
  rawJson?: Record<string, unknown>;
  organizationName?: string;
  website?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  externalIds?: Record<string, string>;
};

export type CandidateScoreResult = {
  fitScore: number;
  riskScore: number;
  priorityScore: number;
  confidence: number;
  scoreBreakdown: Record<string, number>;
  topReasonsToTarget: string[];
  topReasonsToAvoid: string[];
  missingInfo: string[];
  recommendedNextAction: "research" | "export" | "label" | "skip" | "watch";
  priorityTier: "high" | "medium" | "low" | "avoid";
};

export type GeographyDef = {
  states?: string[];
  counties?: string[];
  cities?: string[];
  zips?: string[];
  radius?: { lat: number; lng: number; miles: number } | null;
  polygons?: Array<Array<[number, number]>>;
};

export type SizeSignals = {
  minLocations?: number;
  preferredLocations?: string;
  maxLocations?: number;
  minEmployees?: number;
  maxEmployees?: number;
};

export type ScoringWeights = {
  fit: Record<string, number>;
  risk: Record<string, number>;
};

export type IcpData = {
  targetDescription: string;
  geography: GeographyDef;
  organizationTypesInclude: string[];
  organizationTypesExclude: string[];
  optionalCategories: string[];
  sizeSignals: SizeSignals;
  buyerPersonaTitles: string[];
  painSignals: string[];
  triggerEvents: string[];
  qualitySignals: string[];
  riskSignals: string[];
  sourcePreferences: string[];
  requiredEvidenceFields: string[];
  scoringWeights: ScoringWeights;
};

export const LABEL_VALUES = [
  "strong_fit",
  "possible_fit",
  "not_a_fit",
  "duplicate",
  "needs_research",
  "risky",
] as const;
export type LabelValue = (typeof LABEL_VALUES)[number];

export const LABEL_REASONS = [
  "wrong_category",
  "too_small",
  "too_large",
  "wrong_geography",
  "competitor",
  "financially_distressed",
  "no_staffing_need",
  "no_decision_maker",
  "poor_evidence",
  "other",
] as const;
export type LabelReason = (typeof LABEL_REASONS)[number];

export type ProjectMode =
  | "general"
  | "quinable"
  | "pe_ma"
  | "local"
  | "healthcare"
  | "manufacturing"
  | "b2b_saas";
