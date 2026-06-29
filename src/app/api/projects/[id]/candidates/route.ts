import { prisma } from "@/lib/db";
import { ok, handleError } from "@/lib/api";
import { assertProjectAccess } from "@/lib/access";
import { serializeCandidate } from "@/lib/candidateView";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

// Candidate list with filters (spec 4.9 Candidates Table).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await assertProjectAccess(id);
    const url = new URL(req.url);
    const q = url.searchParams;

    const where: Prisma.CandidateWhereInput = { projectId: id };
    const tier = q.get("tier");
    const state = q.get("state");
    const type = q.get("type");
    const status = q.get("status");
    const search = q.get("q");
    if (tier) where.priorityTier = tier;
    if (status) where.status = status;
    if (type) where.organizationType = { contains: type };
    if (search) where.name = { contains: search };
    if (state) where.locations = { some: { state } };

    const candidates = await prisma.candidate.findMany({
      where,
      include: {
        scores: { orderBy: { createdAt: "desc" }, take: 1 },
        locations: { take: 2 },
        evidence: { take: 6 },
        contacts: { take: 6 },
      },
      take: 1000,
    });

    const serialized = candidates
      .map(serializeCandidate)
      .sort((a, b) => (b.score?.priorityScore ?? 0) - (a.score?.priorityScore ?? 0));

    return ok({ candidates: serialized, total: serialized.length });
  } catch (err) {
    return handleError(err);
  }
}
