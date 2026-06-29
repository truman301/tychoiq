import { z } from "zod";
import { ok, handleError } from "@/lib/api";
import { assertProjectAccess } from "@/lib/access";
import { applyLabel } from "@/lib/labels";
import { recomputeModel } from "@/lib/training/recompute";
import { LABEL_VALUES } from "@/lib/types";

export const dynamic = "force-dynamic";

const Schema = z.object({
  labels: z
    .array(
      z.object({
        candidateId: z.string(),
        label: z.enum(LABEL_VALUES),
        reasons: z.array(z.string()).optional(),
        note: z.string().optional(),
        isHoldout: z.boolean().optional(),
      }),
    )
    .min(1),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await assertProjectAccess(id);
    const body = Schema.parse(await req.json());

    for (const l of body.labels) {
      await applyLabel({
        projectId: id,
        candidateId: l.candidateId,
        label: l.label,
        reasons: l.reasons,
        note: l.note,
        isHoldout: l.isHoldout,
        source: "training",
      });
    }

    // Active-learning recompute after a label batch keeps metrics/centroids live.
    const { snapshotId } = await recomputeModel(id);
    return ok({ labeled: body.labels.length, snapshotId });
  } catch (err) {
    return handleError(err);
  }
}
