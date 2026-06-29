import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, fail, handleError } from "@/lib/api";
import { assertProjectAccess } from "@/lib/access";
import { stringifyJson } from "@/lib/json";
import { buildExport, type ExportCandidate, type ExportFormat } from "@/lib/export/csv";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const Schema = z.object({
  format: z.enum(["csv", "quinable_csv", "clay_csv", "json"]).default("csv"),
  tier: z.string().optional(),
  reviewedOnly: z.boolean().optional(), // Export Gate (spec §9)
  highConfidenceOnly: z.boolean().optional(),
  candidateIds: z.array(z.string()).optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await assertProjectAccess(id);
    const exports = await prisma.exportJob.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
      select: { id: true, format: true, fileName: true, rowCount: true, status: true, createdAt: true },
    });
    return ok(exports);
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await assertProjectAccess(id);
    const body = Schema.parse(await req.json());
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) return fail("Project not found", 404);

    const where: Prisma.CandidateWhereInput = { projectId: id };
    if (body.candidateIds?.length) where.id = { in: body.candidateIds };
    if (body.tier) where.priorityTier = body.tier;

    // Export Gate (spec §9): only reviewed OR high-confidence candidates, and
    // require source URLs present. Default to reviewedOnly unless caller opts out.
    const reviewedOnly = body.reviewedOnly ?? true;

    let candidates = (await prisma.candidate.findMany({
      where,
      include: {
        scores: { orderBy: { createdAt: "desc" }, take: 1 },
        locations: { take: 1 },
        contacts: true,
        evidence: true,
      },
    })) as unknown as (ExportCandidate & { reviewed: boolean; scores: { confidence: number }[]; evidence: { url?: string | null }[] })[];

    const skipped: string[] = [];
    candidates = candidates.filter((c) => {
      const conf = c.scores[0]?.confidence ?? 0;
      const hasUrl = (c.evidence ?? []).some((e) => e.url);
      const meetsReview = c.reviewed || (body.highConfidenceOnly !== false && conf >= 0.8);
      if (reviewedOnly && !meetsReview) {
        skipped.push(`${c.name}: not reviewed and confidence < 0.80`);
        return false;
      }
      if (!hasUrl) {
        skipped.push(`${c.name}: no source URL`);
        return false;
      }
      return true;
    });

    if (candidates.length === 0) {
      return fail("No candidates pass the export gate (reviewed/high-confidence + source URLs).", 422, { skipped });
    }

    const built = buildExport(body.format as ExportFormat, candidates as ExportCandidate[], project.name);
    const job = await prisma.exportJob.create({
      data: {
        projectId: id,
        format: body.format,
        filter: stringifyJson({ tier: body.tier, reviewedOnly, count: candidates.length }),
        status: "completed",
        fileName: built.fileName,
        content: built.content,
        rowCount: built.rowCount,
      },
    });

    return ok({ id: job.id, fileName: built.fileName, rowCount: built.rowCount, skipped }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
