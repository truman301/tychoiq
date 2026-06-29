import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, fail, handleError } from "@/lib/api";
import { assertCandidatesAccess } from "@/lib/access";
import { applyLabel } from "@/lib/labels";
import { recomputeModel } from "@/lib/training/recompute";
import { LABEL_VALUES } from "@/lib/types";

export const dynamic = "force-dynamic";

const Schema = z.object({
  candidateIds: z.array(z.string()).min(1),
  label: z.enum(LABEL_VALUES),
  reasons: z.array(z.string()).optional(),
});

export async function POST(req: Request) {
  try {
    const body = Schema.parse(await req.json());
    await assertCandidatesAccess(body.candidateIds);
    const candidates = await prisma.candidate.findMany({
      where: { id: { in: body.candidateIds } },
      select: { id: true, projectId: true },
    });
    if (candidates.length === 0) return fail("No candidates found", 404);

    const projectIds = new Set<string>();
    for (const c of candidates) {
      await applyLabel({
        projectId: c.projectId,
        candidateId: c.id,
        label: body.label,
        reasons: body.reasons,
        source: "bulk",
      });
      projectIds.add(c.projectId);
    }
    for (const pid of projectIds) await recomputeModel(pid);

    return ok({ labeled: candidates.length });
  } catch (err) {
    return handleError(err);
  }
}
