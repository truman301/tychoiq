import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, handleError } from "@/lib/api";
import { assertProjectAccess } from "@/lib/access";
import { normalizeName, extractDomain } from "@/lib/text";
import { embedExample } from "@/lib/training/recompute";
import { parseCsvToRecords } from "@/lib/connectors/csvImport";

export const dynamic = "force-dynamic";

const ExampleSchema = z.object({
  kind: z.enum(["positive", "negative", "gold", "bad"]),
  inputType: z.enum(["website", "name", "csv", "facility"]).default("name"),
  value: z.string().min(1),
  note: z.string().optional(),
});

const BodySchema = z.object({
  examples: z.array(ExampleSchema).optional(),
  csv: z.string().optional(),
  csvKind: z.enum(["positive", "negative", "gold", "bad"]).optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await assertProjectAccess(id);
    const examples = await prisma.trainingExample.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
    });
    return ok(examples);
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await assertProjectAccess(id);
    const body = BodySchema.parse(await req.json());
    const created: unknown[] = [];

    const addOne = async (e: z.infer<typeof ExampleSchema>) => {
      const rec = await prisma.trainingExample.create({
        data: {
          projectId: id,
          kind: e.kind,
          inputType: e.inputType,
          value: e.value,
          note: e.note,
          normalizedName: normalizeName(e.value),
          domain: extractDomain(e.value),
          embedding: await embedExample(e.value),
        },
      });
      created.push(rec);
    };

    for (const e of body.examples ?? []) await addOne(e);

    if (body.csv && body.csvKind) {
      const records = parseCsvToRecords(body.csv, "Seed CSV");
      for (const r of records) {
        await addOne({
          kind: body.csvKind,
          inputType: "csv",
          value: r.organizationName ?? r.website ?? "",
          note: r.website,
        });
      }
    }

    return ok({ created: created.length, examples: created }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
