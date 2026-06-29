import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, fail, handleError } from "@/lib/api";
import { requireSession } from "@/lib/access";
import { createProjectFromTemplate } from "@/lib/projects";
import { getTemplate, QUINABLE_SEED_EXAMPLES } from "@/lib/templates";
import { embedExample } from "@/lib/training/recompute";

export const dynamic = "force-dynamic";

const CreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  templateKey: z.string().min(1),
  seedQuinableExamples: z.boolean().optional(),
});

export async function GET() {
  try {
    const { workspaceId } = await requireSession();
    const projects = await prisma.project.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: "desc" },
      include: {
        _count: { select: { candidates: true, scanRuns: true, trainingEx: true } },
      },
    });
    return ok(projects);
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request) {
  try {
    const body = CreateSchema.parse(await req.json());
    const template = getTemplate(body.templateKey);
    if (!template) return fail(`Unknown template: ${body.templateKey}`, 400);

    const { workspaceId, user } = await requireSession();
    const project = await createProjectFromTemplate({
      workspaceId,
      name: body.name,
      description: body.description,
      templateKey: body.templateKey,
      createdBy: user.email,
    });

    // Quinable/healthcare templates may seed default examples (user must review).
    if (body.seedQuinableExamples && (template.mode === "quinable" || template.mode === "healthcare")) {
      const make = async (kind: "positive" | "negative", items: { value: string; note: string }[]) =>
        Promise.all(
          items.map(async (it) =>
            prisma.trainingExample.create({
              data: {
                projectId: project.id,
                kind,
                inputType: "name",
                value: it.value,
                note: `${it.note} (default example — review before use)`,
                embedding: await embedExample(it.value),
                createdBy: user.email,
              },
            }),
          ),
        );
      await make("positive", QUINABLE_SEED_EXAMPLES.positive);
      await make("negative", QUINABLE_SEED_EXAMPLES.negative);
    }

    return ok(project, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
