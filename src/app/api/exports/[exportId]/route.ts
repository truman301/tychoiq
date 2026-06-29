import { prisma } from "@/lib/db";
import { fail, handleError } from "@/lib/api";
import { assertExportAccess } from "@/lib/access";

export const dynamic = "force-dynamic";

// Download a previously-built export file.
export async function GET(_req: Request, { params }: { params: Promise<{ exportId: string }> }) {
  try {
    const { exportId } = await params;
    await assertExportAccess(exportId);
    const job = await prisma.exportJob.findUnique({ where: { id: exportId } });
    if (!job || !job.content) return fail("Export not found", 404);

    const mime = job.format === "json" ? "application/json" : "text/csv";
    return new Response(job.content, {
      status: 200,
      headers: {
        "Content-Type": `${mime}; charset=utf-8`,
        "Content-Disposition": `attachment; filename="${job.fileName}"`,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
