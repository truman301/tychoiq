import { describe, it, expect } from "vitest";
import { scoreCandidate, type ScoringCandidate, type ScoringContext } from "@/lib/scoring";
import { QUINABLE_ICP } from "@/lib/templates";

function ctx(over: Partial<ScoringContext> = {}): ScoringContext {
  return { mode: "quinable", icp: QUINABLE_ICP, distinctSourceCount: 2, hasAuthoritativeDatasetEvidence: true, ...over };
}

const strongFit: ScoringCandidate = {
  name: "Lakeside Post-Acute Center",
  organizationType: "skilled nursing facility",
  website: "https://lakeside.example.com",
  state: "MI",
  bedCount: 120,
  starRating: 4,
  services: ["skilled nursing", "post-acute"],
  locations: [{ state: "MI", city: "Grand Rapids", latitude: 42.96, longitude: -85.6 }],
  painSignals: [{ type: "hiring_clinical", text: "now hiring CNAs", evidence: { sourceName: "Website", sourceType: "website", retrievedAt: new Date().toISOString(), confidence: "medium" } }],
  qualitySignals: [
    { type: "multi_site", text: "family of communities" },
    { type: "compliance_orientation", text: "Medicare certified" },
  ],
  riskSignals: [],
  triggerEvents: [{ type: "new_facility", text: "newly opened wing" }],
};

describe("scoring engine", () => {
  it("scores a strong Quinable fit as high priority with low risk", () => {
    const r = scoreCandidate(strongFit, ctx());
    expect(r.fitScore).toBeGreaterThanOrEqual(70);
    expect(r.riskScore).toBeLessThan(35);
    expect(r.priorityTier).toBe("high");
    expect(r.topReasonsToTarget.length).toBeGreaterThan(0);
  });

  it("flags a hospital as avoid (excluded category)", () => {
    const hospital: ScoringCandidate = {
      ...strongFit,
      name: "Metro Regional Hospital",
      organizationType: "hospital",
      hospitalSignals: [{ type: "hospital", text: "acute care hospital" }],
    };
    const r = scoreCandidate(hospital, ctx());
    expect(r.priorityTier).toBe("avoid");
    expect(r.topReasonsToAvoid.join(" ")).toMatch(/hospital/i);
  });

  it("flags a staffing agency competitor as avoid", () => {
    const agency: ScoringCandidate = {
      ...strongFit,
      name: "QuickStaff Healthcare Agency",
      organizationType: "staffing agency",
      competitorSignals: [{ type: "staffing_agency", text: "nurse staffing agency" }],
    };
    const r = scoreCandidate(agency, ctx());
    expect(r.priorityTier).toBe("avoid");
  });

  it("raises risk for receivership / payment distress", () => {
    const risky: ScoringCandidate = {
      ...strongFit,
      name: "Troubled Pines Nursing Center",
      starRating: 1,
      qualitySignals: [],
      riskSignals: [
        { type: "financial_distress", text: "receivership" },
        { type: "payment_risk", text: "unpaid collections lawsuit" },
        { type: "regulatory_risk", text: "civil monetary penalty" },
      ],
    };
    const r = scoreCandidate(risky, ctx());
    expect(r.riskScore).toBeGreaterThanOrEqual(50);
    expect(r.priorityTier === "avoid" || r.priorityTier === "low").toBe(true);
  });

  it("never marks High without enough evidence (quality gate)", () => {
    const r = scoreCandidate(strongFit, ctx({ distinctSourceCount: 1, hasAuthoritativeDatasetEvidence: false }));
    // single source => cannot be High per the candidate quality gate
    expect(r.priorityTier).not.toBe("high");
  });

  it("produces an auditable breakdown summing to the scores", () => {
    const r = scoreCandidate(strongFit, ctx());
    const fitSum = Object.entries(r.scoreBreakdown)
      .filter(([k]) => k.startsWith("fit."))
      .reduce((s, [, v]) => s + v, 0);
    expect(Math.round(fitSum)).toBe(r.fitScore);
  });

  it("keeps scores within 0..100", () => {
    const r = scoreCandidate(strongFit, ctx());
    for (const v of [r.fitScore, r.riskScore, r.priorityScore]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });
});
