import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, fail, handleError } from "@/lib/api";
import { assertProjectAccess } from "@/lib/access";
import { icpFromRow, icpToRow } from "@/lib/icp";
import type { IcpData } from "@/lib/types";

export const dynamic = "force-dynamic";

const UpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.string().optional(),
  validationThreshold: z.number().int().min(0).max(100).optional(),
  minPositiveLabels: z.number().int().min(0).optional(),
  minNegativeLabels: z.number().int().min(0).optional(),
  minReviewed: z.number().int().min(0).optional(),
  icp: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await assertProjectAccess(id);
    const project = await prisma.project.findUnique({
      where: { id },
      include: { icp: true, _count: { select: { candidates: true, scanRuns: true, trainingEx: true } } },
    });
    if (!project) return fail("Project not found", 404);
    return ok({ ...project, icpData: icpFromRow(project.icp, project.mode) });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await assertProjectAccess(id);
    const body = UpdateSchema.parse(await req.json());
    const existing = await prisma.project.findUnique({ where: { id }, include: { icp: true } });
    if (!existing) return fail("Project not found", 404);

    if (body.icp) {
      const merged: IcpData = { ...icpFromRow(existing.icp, existing.mode), ...(body.icp as Partial<IcpData>) };
      await prisma.iCPDefinition.upsert({
        where: { projectId: id },
        update: icpToRow(merged),
        create: { projectId: id, ...icpToRow(merged) },
      });
    }

    const geographySummary = body.icp
      ? ((body.icp as Partial<IcpData>).geography?.states ?? []).join(", ") || existing.geographySummary
      : existing.geographySummary;

    const project = await prisma.project.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        status: body.status,
        validationThreshold: body.validationThreshold,
        minPositiveLabels: body.minPositiveLabels,
        minNegativeLabels: body.minNegativeLabels,
        minReviewed: body.minReviewed,
        geographySummary: geographySummary ?? undefined,
      },
      include: { icp: true },
    });
    return ok({ ...project, icpData: icpFromRow(project.icp, project.mode) });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await assertProjectAccess(id);
    await prisma.project.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}
