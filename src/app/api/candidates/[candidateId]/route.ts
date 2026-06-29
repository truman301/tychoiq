import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, fail, handleError } from "@/lib/api";
import { assertCandidateAccess } from "@/lib/access";
import { serializeCandidate } from "@/lib/candidateView";

export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  notes: z.string().optional(),
  status: z.string().optional(),
  contacted: z.boolean().optional(),
  reviewed: z.boolean().optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ candidateId: string }> }) {
  try {
    const { candidateId } = await params;
    await assertCandidateAccess(candidateId);
    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
      include: {
        scores: { orderBy: { createdAt: "desc" } },
        evidence: true,
        locations: true,
        contacts: true,
        labels: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!candidate) return fail("Candidate not found", 404);
    return ok(serializeCandidate(candidate));
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ candidateId: string }> }) {
  try {
    const { candidateId } = await params;
    await assertCandidateAccess(candidateId);
    const body = PatchSchema.parse(await req.json());
    const updated = await prisma.candidate.update({
      where: { id: candidateId },
      data: body,
      include: { scores: { orderBy: { createdAt: "desc" }, take: 1 }, locations: true, evidence: true, contacts: true },
    });
    return ok(serializeCandidate(updated));
  } catch (err) {
    return handleError(err);
  }
}
