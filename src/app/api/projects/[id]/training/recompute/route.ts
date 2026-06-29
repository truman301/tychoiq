import { ok, handleError } from "@/lib/api";
import { assertProjectAccess } from "@/lib/access";
import { recomputeModel } from "@/lib/training/recompute";
import { getTrainingStatus } from "@/lib/training/status";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await assertProjectAccess(id);
    const { snapshotId } = await recomputeModel(id);
    const status = await getTrainingStatus(id);
    return ok({ snapshotId, status });
  } catch (err) {
    return handleError(err);
  }
}
