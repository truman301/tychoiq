import type { IcpData } from "@/lib/types";

// "Model Understanding" page content (spec 4.3 step 5). Deterministically
// derived from the ICP + label patterns so the user can approve/edit before
// large scans (the ICP lock).

export type ModelRubric = {
  goodTargetLooksLike: string[];
  badTargetLooksLike: string[];
  signalsThatIncreaseScore: string[];
  signalsThatDecreaseScore: string[];
  knownLimitations: string[];
  labelSummary: {
    positives: number;
    negatives: number;
    commonNonFitReasons: string[];
  };
};

export function buildModelRubric(
  icp: IcpData,
  labelStats: { positives: number; negatives: number; reasonCounts: Record<string, number> },
): ModelRubric {
  const commonReasons = Object.entries(labelStats.reasonCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([reason, n]) => `${reason.replace(/_/g, " ")} (${n})`);

  const geo = (icp.geography.states ?? []).join(", ") || "the configured geography";

  return {
    goodTargetLooksLike: [
      icp.targetDescription || "Matches the ideal customer profile description.",
      `Is one of: ${icp.organizationTypesInclude.join(", ") || "the target organization types"}.`,
      `Located in ${geo}.`,
      icp.painSignals.length ? `Shows pain/trigger signals such as: ${icp.painSignals.join("; ")}.` : "",
      icp.qualitySignals.length ? `Shows quality signals such as: ${icp.qualitySignals.join("; ")}.` : "",
    ].filter(Boolean),
    badTargetLooksLike: [
      icp.organizationTypesExclude.length
        ? `Is an excluded type: ${icp.organizationTypesExclude.join(", ")}.`
        : "Falls outside the target categories.",
      "Outside the target geography.",
      icp.riskSignals.length ? `Shows risk signals such as: ${icp.riskSignals.join("; ")}.` : "Shows financial/regulatory risk.",
      "Too small / one-off with no repeat potential.",
    ].filter(Boolean),
    signalsThatIncreaseScore: [
      "Category match to target organization types",
      "Located within target geography",
      ...(icp.painSignals.length ? ["Recurring pain/staffing-need signals"] : []),
      "Multi-location / expansion potential",
      "Two or more independent evidence sources",
      ...(icp.qualitySignals.length ? ["Operator quality / compliance signals"] : []),
    ],
    signalsThatDecreaseScore: [
      "Financial distress / receivership / bankruptcy",
      "Payment-risk or nonpayment signals",
      "Severe regulatory penalties",
      "Excluded category (e.g. hospital, staffing agency, competitor)",
      "Thin or single-source evidence",
      "Too small / single-site with no repeat potential",
    ],
    knownLimitations: [
      "MVP runs in mock mode by default; real-world coverage depends on enabled connectors and API keys.",
      "Payment-quality is inferred from public proxies, not financial statements.",
      "Embeddings use a deterministic offline model unless an embeddings provider is configured.",
      "Scores reflect public evidence available at scan time and should be human-reviewed before outreach.",
    ],
    labelSummary: {
      positives: labelStats.positives,
      negatives: labelStats.negatives,
      commonNonFitReasons: commonReasons,
    },
  };
}
