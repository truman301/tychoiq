import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, fail, handleError } from "@/lib/api";
import { assertProjectAccess } from "@/lib/access";
import { stringifyJson } from "@/lib/json";
import { parseCsvToRecords } from "@/lib/connectors/csvImport";
import { runScan } from "@/lib/pipeline/scan";
import type { RawSourceRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

const ManualRecord = z.object({
  organizationName: z.string().min(1),
  website: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  description: z.string().optional(),
});

const Schema = z.object({
  csv: z.string().optional(),
  records: z.array(ManualRecord).optional(),
  sourceName: z.string().optional(),
});

// CSV import + manual candidate add (Phase 3). Routes user-supplied records
// through the full enrich -> score -> persist pipeline via the ImportConnector.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await assertProjectAccess(id);
    const body = Schema.parse(await req.json());
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) return fail("Project not found", 404);

    const now = new Date().toISOString();
    let records: RawSourceRecord[] = [];
    if (body.csv) records = parseCsvToRecords(body.csv, body.sourceName ?? "CSV Import");
    if (body.records) {
      records = records.concat(
        body.records.map((r) => ({
          sourceType: "import",
          sourceName: body.sourceName ?? "Manual Add",
          retrievedAt: now,
          rawTitle: r.organizationName,
          rawText: r.description ?? `${r.organizationName} (manually added)`,
          organizationName: r.organizationName,
          website: r.website,
          phone: r.phone,
          address: r.address,
          city: r.city,
          state: r.state,
          postalCode: r.postalCode,
          country: "US",
        })),
      );
    }
    if (records.length === 0) return fail("No records to import (provide csv or records)", 400);

    const scan = await prisma.scanRun.create({
      data: {
        projectId: id,
        type: "sample",
        status: "queued",
        params: stringifyJson({
          connectors: ["csv_import"],
          importRecords: records,
          maxCandidates: Math.min(records.length + 10, 500),
        }),
      },
    });
    await runScan(scan.id);

    const finished = await prisma.scanRun.findUnique({
      where: { id: scan.id },
      include: { _count: { select: { candidates: true } } },
    });
    return ok({ imported: records.length, scan: finished }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
