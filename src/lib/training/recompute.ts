import { prisma } from "@/lib/db";
import { icpFromRow } from "@/lib/icp";
import { parseJson, parseStringArray, stringifyJson } from "@/lib/json";
import { embed, embedMany, centroid } from "@/lib/embeddings";
import { candidateEmbeddingText } from "@/lib/embeddings";
import {
  computeValidationMetrics,
  labelIsPositive,
  tierIsPositive,
  type EvalSample,
} from "@/lib/training/metrics";
import { buildModelRubric } from "@/lib/training/rubric";

// Active-learning recompute (spec 4.3 step 4-5). Updates positive/negative
// embedding centroids, computes holdout validation metrics from labeled
// candidates, regenerates the "Model Understanding" rubric, and snapshots it
// so results stay reproducible (spec §5: store every scoring model snapshot).

export async function recomputeModel(projectId: string): Promise<{ snapshotId: string }> {
  const project = await prisma.project.findUnique({ where: { id: projectId }, include: { icp: true } });
  if (!project) throw new Error("Project not found");
  const icp = icpFromRow(project.icp, project.mode);

  // --- centroids from seed examples + labeled candidates --------------------
  const examples = await prisma.trainingExample.findMany({ where: { projectId } });
  const labels = await prisma.candidateLabel.findMany({
    where: { projectId },
    include: { candidate: true },
    orderBy: { createdAt: "desc" },
  });

  // Keep one label per candidate (latest).
  const latestByCandidate = new Map<string, (typeof labels)[number]>();
  for (const lab of labels) {
    if (!latestByCandidate.has(lab.candidateId)) latestByCandidate.set(lab.candidateId, lab);
  }
  const latestLabels = [...latestByCandidate.values()];

  const posTexts: string[] = [];
  const negTexts: string[] = [];

  for (const ex of examples) {
    const text = ex.value;
    if (ex.kind === "positive" || ex.kind === "gold") posTexts.push(text);
    else if (ex.kind === "negative" || ex.kind === "bad") negTexts.push(text);
  }
  for (const lab of latestLabels) {
    const c = lab.candidate;
    const text = candidateEmbeddingText({
      name: c.name,
      organizationType: c.organizationType,
      description: c.description,
      services: parseStringArray(c.services),
    });
    const pos = labelIsPositive(lab.label);
    if (pos === true) posTexts.push(text);
    else if (pos === false) negTexts.push(text);
  }

  const posVecs = posTexts.length ? await embedMany(posTexts) : [];
  const negVecs = negTexts.length ? await embedMany(negTexts) : [];
  const posCentroid = centroid(posVecs);
  const negCentroid = centroid(negVecs);

  // --- validation metrics from labeled candidates ---------------------------
  const samples: EvalSample[] = [];
  for (const lab of latestLabels) {
    const actual = labelIsPositive(lab.label);
    if (actual == null) continue; // duplicate / needs_research excluded
    const tier = lab.candidate.priorityTier;
    samples.push({ predictedPositive: tierIsPositive(tier), actualPositive: actual });
  }
  const metrics = computeValidationMetrics(samples);

  // confusing cases: labeled positives we predicted negative & vice versa
  const falseNegatives = latestLabels.filter(
    (l) => labelIsPositive(l.label) === true && !tierIsPositive(l.candidate.priorityTier),
  ).length;
  const falsePositives = latestLabels.filter(
    (l) => labelIsPositive(l.label) === false && tierIsPositive(l.candidate.priorityTier),
  ).length;

  // --- label stats for rubric -----------------------------------------------
  const reasonCounts: Record<string, number> = {};
  let positives = 0;
  let negatives = 0;
  for (const lab of latestLabels) {
    const p = labelIsPositive(lab.label);
    if (p === true) positives++;
    else if (p === false) negatives++;
    for (const r of parseStringArray(lab.reasons)) reasonCounts[r] = (reasonCounts[r] ?? 0) + 1;
  }
  // include seed example counts
  positives += examples.filter((e) => e.kind === "positive" || e.kind === "gold").length;
  negatives += examples.filter((e) => e.kind === "negative" || e.kind === "bad").length;

  const rubric = buildModelRubric(icp, { positives, negatives, reasonCounts });

  const prev = await prisma.trainingModelSnapshot.findFirst({
    where: { projectId },
    orderBy: { version: "desc" },
  });

  const snapshot = await prisma.trainingModelSnapshot.create({
    data: {
      projectId,
      version: (prev?.version ?? 0) + 1,
      positiveCentroid: posCentroid ? stringifyJson(posCentroid) : null,
      negativeCentroid: negCentroid ? stringifyJson(negCentroid) : null,
      weights: stringifyJson(icp.scoringWeights),
      metrics: stringifyJson({ ...metrics, falseNegatives, falsePositives }),
      rubric: stringifyJson(rubric),
      approved: false,
    },
  });

  return { snapshotId: snapshot.id };
}

// Ensure a training example has an embedding stored.
export async function embedExample(value: string): Promise<string> {
  const v = await embed(value);
  return stringifyJson(v);
}
