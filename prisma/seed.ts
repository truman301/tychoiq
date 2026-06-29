// Demo seed: creates a Quinable Mode project, seeds reviewed examples, runs a
// discovery sample scan (mock connectors), and recomputes the training model so
// the app shows a meaningful end-to-end demo on first run.
//
// Run: npm run db:seed   (uses tsx --env-file=.env)

import { prisma } from "@/lib/db";
import { createUserWithWorkspace } from "@/lib/auth";
import { createProjectFromTemplate } from "@/lib/projects";
import { QUINABLE_SEED_EXAMPLES } from "@/lib/templates";
import { embedExample, recomputeModel } from "@/lib/training/recompute";
import { runScan } from "@/lib/pipeline/scan";
import { stringifyJson } from "@/lib/json";

const DEMO_EMAIL = "demo@tychoiq.com";
const DEMO_PASSWORD = "demo12345";

async function main() {
  console.log("→ Ensuring demo account…");
  let user = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (!user) {
    user = await createUserWithWorkspace({ email: DEMO_EMAIL, password: DEMO_PASSWORD, name: "Demo User" });
    console.log(`✓ Created demo login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  }
  const membership = await prisma.workspaceMember.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
  const workspaceId = membership!.workspaceId;

  // Avoid duplicate demo project on re-seed.
  const existing = await prisma.project.findFirst({
    where: { workspaceId, name: "Quinable Demo — Michigan/Texas/Ohio" },
  });
  if (existing) {
    console.log("✓ Demo project already exists:", existing.id);
    return;
  }

  console.log("→ Creating Quinable demo project…");
  const project = await createProjectFromTemplate({
    workspaceId,
    name: "Quinable Demo — Michigan/Texas/Ohio",
    templateKey: "quinable",
    createdBy: user.email,
    description: "Demo project with mock data only. Mock prospects are synthetic, not real entities.",
  });

  console.log("→ Seeding reviewed example labels…");
  for (const ex of QUINABLE_SEED_EXAMPLES.positive) {
    await prisma.trainingExample.create({
      data: { projectId: project.id, kind: "positive", inputType: "name", value: ex.value, note: ex.note, embedding: await embedExample(ex.value), createdBy: user.email },
    });
  }
  for (const ex of QUINABLE_SEED_EXAMPLES.negative) {
    await prisma.trainingExample.create({
      data: { projectId: project.id, kind: "negative", inputType: "name", value: ex.value, note: ex.note, embedding: await embedExample(ex.value), createdBy: user.email },
    });
  }

  console.log("→ Running discovery sample scan (mock connectors)…");
  const scan = await prisma.scanRun.create({
    data: { projectId: project.id, type: "sample", status: "queued", params: stringifyJson({ maxCandidates: 50 }) },
  });
  await runScan(scan.id);

  const candidateCount = await prisma.candidate.count({ where: { projectId: project.id } });
  console.log(`✓ Scan complete: ${candidateCount} candidates.`);

  console.log("→ Auto-labeling a few demo candidates for active learning…");
  const named = await prisma.candidate.findMany({
    where: { projectId: project.id },
    include: { scores: true },
    take: 50,
  });
  // Deterministic demo labels based on the named demo orgs.
  const labelMap: Record<string, string> = {
    "Lakeside Post-Acute Center": "strong_fit",
    "Evergreen Senior Living Group": "strong_fit",
    "Riverbend Rehabilitation & Nursing": "strong_fit",
    "Harbor Home Health Services": "possible_fit",
    "Sunrise Memory Care of North County": "possible_fit",
    "Metro Regional Hospital": "not_a_fit",
    "QuickStaff Healthcare Agency": "not_a_fit",
    "Troubled Pines Nursing Center": "risky",
  };
  for (const c of named) {
    const label = labelMap[c.name];
    if (!label) continue;
    await prisma.candidateLabel.create({
      data: { projectId: project.id, candidateId: c.id, label, source: "training", createdBy: user.email },
    });
    await prisma.candidate.update({ where: { id: c.id }, data: { reviewed: true, status: "reviewed" } });
  }

  console.log("→ Recomputing training model (centroids + metrics + rubric)…");
  await recomputeModel(project.id);

  console.log("\n✅ Seed complete.");
  console.log(`   Login:   ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`   Project: ${project.name} (${project.id})`);
  console.log("   Open the app, sign in, and explore training + candidates.");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
