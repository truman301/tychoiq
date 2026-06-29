import { describe, it, expect } from "vitest";
import { evaluateTrainingGate, type TrainingGateInput } from "@/lib/training/gate";
import { computeValidationMetrics } from "@/lib/training/metrics";

const thresholds = { minPositiveLabels: 20, minNegativeLabels: 20, minReviewed: 30, validationPrecision: 75 };

function input(over: Partial<TrainingGateInput> = {}): TrainingGateInput {
  return {
    positiveLabels: 20,
    negativeLabels: 20,
    reviewedCount: 30,
    validationPrecision: 0.8,
    validationSampleSize: 30,
    modelApproved: true,
    enabledConnectorCount: 2,
    thresholds,
    ...over,
  };
}

describe("training gate", () => {
  it("unlocks large scans when all requirements are met", () => {
    const r = evaluateTrainingGate(input());
    expect(r.canRunLargeScan).toBe(true);
    expect(r.metCount).toBe(r.totalCount);
  });

  it("blocks when positive labels are insufficient", () => {
    const r = evaluateTrainingGate(input({ positiveLabels: 5 }));
    expect(r.canRunLargeScan).toBe(false);
    expect(r.requirements.find((x) => x.key === "positive_labels")?.met).toBe(false);
  });

  it("blocks when precision is below threshold", () => {
    const r = evaluateTrainingGate(input({ validationPrecision: 0.5 }));
    expect(r.canRunLargeScan).toBe(false);
    expect(r.requirements.find((x) => x.key === "validation_precision")?.met).toBe(false);
  });

  it("blocks when the model is not approved (ICP lock)", () => {
    const r = evaluateTrainingGate(input({ modelApproved: false }));
    expect(r.canRunLargeScan).toBe(false);
  });

  it("treats missing precision as not-met but still allows override with a connector", () => {
    const r = evaluateTrainingGate(input({ validationPrecision: null, modelApproved: false, positiveLabels: 0, negativeLabels: 0 }));
    expect(r.canRunLargeScan).toBe(false);
    expect(r.canOverride).toBe(true); // has a connector enabled
  });

  it("cannot override without any connector enabled", () => {
    const r = evaluateTrainingGate(input({ enabledConnectorCount: 0 }));
    expect(r.canOverride).toBe(false);
  });
});

describe("validation metrics", () => {
  it("computes precision/recall/f1 correctly", () => {
    const m = computeValidationMetrics([
      { predictedPositive: true, actualPositive: true }, // tp
      { predictedPositive: true, actualPositive: true }, // tp
      { predictedPositive: true, actualPositive: false }, // fp
      { predictedPositive: false, actualPositive: true }, // fn
      { predictedPositive: false, actualPositive: false }, // tn
    ]);
    expect(m.truePositives).toBe(2);
    expect(m.falsePositives).toBe(1);
    expect(m.falseNegatives).toBe(1);
    expect(m.precision).toBeCloseTo(2 / 3, 2);
    expect(m.recall).toBeCloseTo(2 / 3, 2);
  });

  it("handles the empty case without dividing by zero", () => {
    const m = computeValidationMetrics([]);
    expect(m.precision).toBe(0);
    expect(m.recall).toBe(0);
    expect(m.f1).toBe(0);
  });
});
