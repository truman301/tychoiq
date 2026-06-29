import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, fail, handleError } from "@/lib/api";
import { assertCandidateAccess } from "@/lib/access";
import { applyLabel } from "@/lib/labels";
import { LABEL_VALUES } from "@/lib/types";

export const dynamic = "force-dynamic";

const Schema = z.object({
  label: z.enum(LABEL_VALUES),
  reasons: z.array(z.string()).optional(),
  note: z.string().optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ candidateId: string }> }) {
  try {
    const { candidateId } = await params;
    await assertCandidateAccess(candidateId);
    const body = Schema.parse(await req.json());
    const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } });
    if (!candidate) return fail("Candidate not found", 404);

    const label = await applyLabel({
      projectId: candidate.projectId,
      candidateId,
      label: body.label,
      reasons: body.reasons,
      note: body.note,
      source: "review",
    });
    return ok(label);
  } catch (err) {
    return handleError(err);
  }
}
