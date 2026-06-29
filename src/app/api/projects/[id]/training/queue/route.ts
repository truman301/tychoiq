import { prisma } from "@/lib/db";
import { ok, handleError } from "@/lib/api";
import { assertProjectAccess } from "@/lib/access";
import { parseJson, parseStringArray } from "@/lib/json";
import type { Signal } from "@/lib/types";

export const dynamic = "force-dynamic";

// Label queue (spec 4.3 step 3): unlabeled candidates ordered by uncertainty
// (closest to the decision boundary first), so labeling is maximally useful.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await assertProjectAccess(id);
    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 25), 100);

    const labeled = await prisma.candidateLabel.findMany({
      where: { projectId: id },
      select: { candidateId: true },
    });
    const labeledIds = new Set(labeled.map((l) => l.candidateId));

    const candidates = await prisma.candidate.findMany({
      where: { projectId: id, id: { notIn: [...labeledIds] } },
      include: { scores: { orderBy: { createdAt: "desc" }, take: 1 }, locations: { take: 1 }, evidence: { take: 4 } },
      take: 200,
    });

    const withUncertainty = candidates
      .map((c) => {
        const score = c.scores[0];
        const priority = score?.priorityScore ?? 50;
        // distance from the 60 boundary => uncertainty
        const uncertainty = 100 - Math.abs(priority - 60);
        return { c, uncertainty };
      })
      .sort((a, b) => b.uncertainty - a.uncertainty)
      .slice(0, limit)
      .map(({ c }) => {
        const score = c.scores[0];
        const loc = c.locations[0];
        return {
          id: c.id,
          name: c.name,
          website: c.website,
          organizationType: c.organizationType,
          location: loc ? [loc.city, loc.state].filter(Boolean).join(", ") : null,
          tentativeScore: score?.priorityScore ?? null,
          priorityTier: c.priorityTier,
          fitScore: score?.fitScore ?? null,
          riskScore: score?.riskScore ?? null,
          confidence: score?.confidence ?? null,
          painSignals: parseJson<Signal[]>(c.painSignals, []).map((s) => s.text || s.type),
          riskSignals: parseJson<Signal[]>(c.riskSignals, []).map((s) => s.text || s.type),
          services: parseStringArray(c.services),
          evidence: c.evidence.map((e) => ({ sourceName: e.sourceName, url: e.url, snippet: e.snippet })),
        };
      });

    return ok({ queue: withUncertainty, remaining: candidates.length });
  } catch (err) {
    return handleError(err);
  }
}
