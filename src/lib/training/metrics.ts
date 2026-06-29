// Validation metrics from labeled candidates vs. model predictions.
// Ground truth: strong_fit/possible_fit => positive; not_a_fit/risky => negative.
// Prediction: tier high/medium => predicted positive; low/avoid => predicted negative.

export type EvalSample = { predictedPositive: boolean; actualPositive: boolean };

export type ValidationMetrics = {
  count: number;
  truePositives: number;
  falsePositives: number;
  trueNegatives: number;
  falseNegatives: number;
  precision: number; // 0..1
  recall: number; // 0..1
  f1: number; // 0..1
};

export function computeValidationMetrics(samples: EvalSample[]): ValidationMetrics {
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;
  for (const s of samples) {
    if (s.predictedPositive && s.actualPositive) tp++;
    else if (s.predictedPositive && !s.actualPositive) fp++;
    else if (!s.predictedPositive && s.actualPositive) fn++;
    else tn++;
  }
  const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return {
    count: samples.length,
    truePositives: tp,
    falsePositives: fp,
    trueNegatives: tn,
    falseNegatives: fn,
    precision: Math.round(precision * 1000) / 1000,
    recall: Math.round(recall * 1000) / 1000,
    f1: Math.round(f1 * 1000) / 1000,
  };
}

export function labelIsPositive(label: string): boolean | null {
  if (label === "strong_fit" || label === "possible_fit") return true;
  if (label === "not_a_fit" || label === "risky") return false;
  return null; // duplicate / needs_research are excluded from precision calc
}

export function tierIsPositive(tier: string | null | undefined): boolean {
  return tier === "high" || tier === "medium";
}
