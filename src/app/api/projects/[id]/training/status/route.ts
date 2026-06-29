import { ok, handleError } from "@/lib/api";
import { assertProjectAccess } from "@/lib/access";
import { getTrainingStatus } from "@/lib/training/status";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await assertProjectAccess(id);
    const status = await getTrainingStatus(id);
    return ok(status);
  } catch (err) {
    return handleError(err);
  }
}
