import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, fail, handleError } from "@/lib/api";
import { assertProjectAccess } from "@/lib/access";
import { stringifyJson } from "@/lib/json";
import { getTrainingStatus } from "@/lib/training/status";
import { runScan } from "@/lib/pipeline/scan";

export const dynamic = "force-dynamic";

const CreateScanSchema = z.object({
  type: z.enum(["sample", "large"]).default("sample"),
  regions: z.array(z.string()).optional(),
  maxCandidates: z.number().int().min(1).max(500).optional(),
  connectors: z.array(z.string()).optional(),
  override: z.boolean().optional(), // admin override of the large-scan gate
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await assertProjectAccess(id);
    const scans = await prisma.scanRun.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { candidates: true, logs: true } } },
    });
    return ok(scans);
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await assertProjectAccess(id);
    const body = CreateScanSchema.parse(await req.json());

    const project = await prisma.project.findUnique({ where: { id }, include: { icp: true } });
    if (!project) return fail("Project not found", 404);

    // Large Scan Gate (spec 4.3 step 6 / §9).
    if (body.type === "large") {
      const status = await getTrainingStatus(id);
      if (!status.gate.canRunLargeScan && !body.override) {
        return fail("Large scan is locked until training requirements are met.", 403, {
          gate: status.gate,
          hint: "Pass override:true to force (admin override) — only if you accept lower precision.",
        });
      }
      if (!status.gate.canOverride) {
        return fail("Enable at least one source connector before scanning.", 403, { gate: status.gate });
      }
      await prisma.project.update({ where: { id }, data: { scanUnlocked: true } });
    }

    const regions = body.regions ?? [];
    const scan = await prisma.scanRun.create({
      data: {
        projectId: id,
        type: body.type,
        status: "queued",
        params: stringifyJson({
          regions,
          maxCandidates: body.maxCandidates ?? (body.type === "sample" ? 50 : 200),
          connectors: body.connectors,
          override: body.override ?? false,
        }),
      },
    });

    await prisma.project.update({ where: { id }, data: { status: "scanning" } });

    // In-process job runner. Awaited here so the demo/E2E is deterministic in
    // mock mode (fast). Production: hand off to a BullMQ/Redis worker instead.
    await runScan(scan.id);

    const finished = await prisma.scanRun.findUnique({
      where: { id: scan.id },
      include: { _count: { select: { candidates: true } } },
    });
    await prisma.project.update({ where: { id }, data: { status: "ready" } });

    return ok(finished, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
