import type { ScoringWeights } from "@/lib/types";

// General default scoring weights (spec 4.7).
export const GENERAL_WEIGHTS: ScoringWeights = {
  fit: {
    category_fit: 20,
    geography_fit: 10,
    size_fit: 10,
    pain_signal_strength: 15,
    timing_or_trigger_strength: 10,
    decision_maker_quality: 10,
    expansion_potential: 10,
    evidence_quality: 10,
    confidence_adjustment: 5,
  },
  risk: {
    financial_distress: 25,
    regulatory_or_legal_risk: 20,
    bad_customer_signals: 20,
    poor_data_quality: 10,
    wrong_size_or_one_off: 10,
    competitor_or_conflict: 10,
    user_defined_risks: 5,
  },
};

// Quinable-specific scoring weights (spec 4.8).
export const QUINABLE_WEIGHTS: ScoringWeights = {
  fit: {
    facility_type_fit: 15,
    geography_density_fit: 10,
    staffing_need_signal: 20,
    repeat_volume_potential: 15,
    multi_location_expansion: 15,
    payment_quality_proxy: 10,
    compliance_and_operational_maturity: 10,
    evidence_quality: 5,
  },
  risk: {
    financial_distress_or_receivership: 30,
    payment_risk_signal: 25,
    severe_regulatory_risk: 15,
    poor_operational_maturity: 10,
    too_small_or_one_off: 10,
    duplicate_or_bad_data: 5,
    competitor_or_conflict: 5,
  },
};

export function weightsForMode(mode: string): ScoringWeights {
  return mode === "quinable" ? QUINABLE_WEIGHTS : GENERAL_WEIGHTS;
}
