import { prisma } from "@/lib/db";
import { ok, handleError } from "@/lib/api";
import { assertScanAccess } from "@/lib/access";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ scanId: string }> }) {
  try {
    const { scanId } = await params;
    await assertScanAccess(scanId);
    const scan = await prisma.scanRun.findUnique({ where: { id: scanId } });
    // In-process scans complete synchronously in mock mode; cancel only affects
    // queued/running scans (relevant once a real async worker is wired up).
    if (scan && (scan.status === "queued" || scan.status === "running")) {
      await prisma.scanRun.update({
        where: { id: scanId },
        data: { status: "cancelled", completedAt: new Date() },
      });
    }
    return ok({ cancelled: true });
  } catch (err) {
    return handleError(err);
  }
}
