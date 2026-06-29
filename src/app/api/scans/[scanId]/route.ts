import { prisma } from "@/lib/db";
import { ok, fail, handleError } from "@/lib/api";
import { assertScanAccess } from "@/lib/access";
import { parseJson } from "@/lib/json";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ scanId: string }> }) {
  try {
    const { scanId } = await params;
    await assertScanAccess(scanId);
    const scan = await prisma.scanRun.findUnique({
      where: { id: scanId },
      include: {
        sourceRuns: true,
        logs: { orderBy: { createdAt: "asc" } },
        _count: { select: { candidates: true } },
      },
    });
    if (!scan) return fail("Scan not found", 404);
    return ok({ ...scan, countsParsed: parseJson(scan.counts, {}) });
  } catch (err) {
    return handleError(err);
  }
}
