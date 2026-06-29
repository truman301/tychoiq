import { prisma } from "@/lib/db";
import { parseJson } from "@/lib/json";
import { evaluateTrainingGate, type TrainingGateResult } from "@/lib/training/gate";
import { labelIsPositive } from "@/lib/training/metrics";
import type { ModelRubric } from "@/lib/training/rubric";
import type { ValidationMetrics } from "@/lib/training/metrics";

export type TrainingStatus = {
  positiveLabels: number;
  negativeLabels: number;
  reviewedCount: number;
  seedPositives: number;
  seedNegatives: number;
  metrics: (ValidationMetrics & { falseNegatives?: number; falsePositives?: number }) | null;
  rubric: ModelRubric | null;
  modelApproved: boolean;
  scanUnlocked: boolean;
  latestSnapshotId: string | null;
  latestSnapshotVersion: number | null;
  gate: TrainingGateResult;
};

export async function getTrainingStatus(projectId: string): Promise<TrainingStatus> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error("Project not found");

  const [labels, examples, snapshot, workspaceConnectors] = await Promise.all([
    prisma.candidateLabel.findMany({ where: { projectId }, orderBy: { createdAt: "desc" } }),
    prisma.trainingExample.findMany({ where: { projectId } }),
    prisma.trainingModelSnapshot.findFirst({ where: { projectId }, orderBy: { version: "desc" } }),
    prisma.sourceConnector.findMany({ where: { workspaceId: project.workspaceId, enabled: true } }),
  ]);

  // latest label per candidate
  const latestByCandidate = new Map<string, (typeof labels)[number]>();
  for (const lab of labels) if (!latestByCandidate.has(lab.candidateId)) latestByCandidate.set(lab.candidateId, lab);
  const latest = [...latestByCandidate.values()];

  let positiveLabels = 0;
  let negativeLabels = 0;
  for (const lab of latest) {
    const p = labelIsPositive(lab.label);
    if (p === true) positiveLabels++;
    else if (p === false) negativeLabels++;
  }
  const seedPositives = examples.filter((e) => e.kind === "positive" || e.kind === "gold").length;
  const seedNegatives = examples.filter((e) => e.kind === "negative" || e.kind === "bad").length;

  // Count seed examples toward label requirements so users can satisfy the gate
  // via seed examples + labeling (documented behavior).
  const totalPositive = positiveLabels + seedPositives;
  const totalNegative = negativeLabels + seedNegatives;
  const reviewedCount = latest.length;

  const metrics = snapshot?.metrics
    ? parseJson<ValidationMetrics & { falseNegatives?: number; falsePositives?: number }>(snapshot.metrics, null as never)
    : null;
  const rubric = snapshot?.rubric ? parseJson<ModelRubric>(snapshot.rubric, null as never) : null;

  const gate = evaluateTrainingGate({
    positiveLabels: totalPositive,
    negativeLabels: totalNegative,
    reviewedCount,
    validationPrecision: metrics ? metrics.precision : null,
    validationSampleSize: metrics ? metrics.count : 0,
    modelApproved: project.modelApproved,
    enabledConnectorCount: workspaceConnectors.length,
    thresholds: {
      minPositiveLabels: project.minPositiveLabels,
      minNegativeLabels: project.minNegativeLabels,
      minReviewed: project.minReviewed,
      validationPrecision: project.validationThreshold,
    },
  });

  return {
    positiveLabels: totalPositive,
    negativeLabels: totalNegative,
    reviewedCount,
    seedPositives,
    seedNegatives,
    metrics,
    rubric,
    modelApproved: project.modelApproved,
    scanUnlocked: project.scanUnlocked,
    latestSnapshotId: snapshot?.id ?? null,
    latestSnapshotVersion: snapshot?.version ?? null,
    gate,
  };
}
