// Large-scan training gate (spec 2.3 / 4.3 step 6 / 9). Pure + testable.

export type TrainingGateInput = {
  positiveLabels: number;
  negativeLabels: number;
  reviewedCount: number;
  validationPrecision: number | null; // 0..1, null if not yet computed
  validationSampleSize: number;
  modelApproved: boolean;
  enabledConnectorCount: number;
  thresholds: {
    minPositiveLabels: number;
    minNegativeLabels: number;
    minReviewed: number;
    validationPrecision: number; // percent, e.g. 75
  };
};

export type RequirementStatus = {
  key: string;
  label: string;
  met: boolean;
  current: number | string;
  required: number | string;
};

export type TrainingGateResult = {
  requirements: RequirementStatus[];
  metCount: number;
  totalCount: number;
  canRunLargeScan: boolean; // all requirements met
  canOverride: boolean; // admin may override with warning
};

export function evaluateTrainingGate(input: TrainingGateInput): TrainingGateResult {
  const t = input.thresholds;
  const precisionPct = input.validationPrecision == null ? null : input.validationPrecision * 100;

  const requirements: RequirementStatus[] = [
    {
      key: "positive_labels",
      label: "Positive labels",
      met: input.positiveLabels >= t.minPositiveLabels,
      current: input.positiveLabels,
      required: t.minPositiveLabels,
    },
    {
      key: "negative_labels",
      label: "Negative labels",
      met: input.negativeLabels >= t.minNegativeLabels,
      current: input.negativeLabels,
      required: t.minNegativeLabels,
    },
    {
      key: "reviewed",
      label: "Reviewed candidate examples",
      met: input.reviewedCount >= t.minReviewed,
      current: input.reviewedCount,
      required: t.minReviewed,
    },
    {
      key: "validation_precision",
      label: "Holdout validation precision",
      met: precisionPct != null && precisionPct >= t.validationPrecision,
      current: precisionPct == null ? "n/a" : `${Math.round(precisionPct)}%`,
      required: `${t.validationPrecision}%`,
    },
    {
      key: "model_approved",
      label: "ICP model approved (lock)",
      met: input.modelApproved,
      current: input.modelApproved ? "approved" : "pending",
      required: "approved",
    },
    {
      key: "connectors",
      label: "Source connectors enabled",
      met: input.enabledConnectorCount >= 1,
      current: input.enabledConnectorCount,
      required: 1,
    },
  ];

  const metCount = requirements.filter((r) => r.met).length;
  return {
    requirements,
    metCount,
    totalCount: requirements.length,
    canRunLargeScan: metCount === requirements.length,
    // Override still requires at least one connector so a scan can physically run.
    canOverride: input.enabledConnectorCount >= 1,
  };
}
