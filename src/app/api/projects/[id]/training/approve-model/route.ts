import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, fail, handleError } from "@/lib/api";
import { assertProjectAccess } from "@/lib/access";
import { getTrainingStatus } from "@/lib/training/status";

export const dynamic = "force-dynamic";

const Schema = z.object({
  approved: z.boolean().default(true),
  editedRubric: z.unknown().optional(),
});

// Human ICP lock (spec 4.3 step 5). Approving the model snapshot is a hard gate.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await assertProjectAccess(id);
    const body = Schema.parse(await req.json());

    const snapshot = await prisma.trainingModelSnapshot.findFirst({
      where: { projectId: id },
      orderBy: { version: "desc" },
    });
    if (!snapshot) return fail("No model snapshot yet — run training recompute first", 400);

    await prisma.trainingModelSnapshot.update({
      where: { id: snapshot.id },
      data: {
        approved: body.approved,
        approvedAt: body.approved ? new Date() : null,
        rubric: body.editedRubric ? JSON.stringify(body.editedRubric) : snapshot.rubric,
      },
    });

    await prisma.project.update({
      where: { id },
      data: { modelApproved: body.approved, status: body.approved ? "ready" : "training" },
    });

    await prisma.auditLog.create({
      data: {
        projectId: id,
        action: body.approved ? "model.approved" : "model.unapproved",
        entityType: "model_snapshot",
        entityId: snapshot.id,
      },
    });

    const status = await getTrainingStatus(id);
    return ok({ approved: body.approved, status });
  } catch (err) {
    return handleError(err);
  }
}
