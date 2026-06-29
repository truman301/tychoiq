import { prisma } from "@/lib/db";
import { getTemplate, type ProjectTemplateDef } from "@/lib/templates";
import { icpToRow } from "@/lib/icp";
import type { IcpData } from "@/lib/types";

export type CreateProjectInput = {
  workspaceId: string;
  name: string;
  description?: string;
  templateKey: string;
  createdBy?: string;
  icpOverrides?: Partial<IcpData>;
};

export async function createProjectFromTemplate(input: CreateProjectInput) {
  const template = getTemplate(input.templateKey);
  if (!template) throw new Error(`Unknown template: ${input.templateKey}`);

  const icp: IcpData = { ...template.icp, ...input.icpOverrides };
  const geographySummary = (icp.geography.states ?? []).join(", ") || (icp.geography.cities ?? []).join(", ") || "Not set";

  const project = await prisma.project.create({
    data: {
      workspaceId: input.workspaceId,
      name: input.name,
      description: input.description ?? template.description,
      industry: template.industry,
      geographySummary,
      templateKey: template.key,
      mode: template.mode,
      status: "draft",
      createdBy: input.createdBy,
      icp: { create: icpToRow(icp) },
    },
    include: { icp: true },
  });

  await prisma.auditLog.create({
    data: {
      workspaceId: input.workspaceId,
      projectId: project.id,
      actor: input.createdBy,
      action: "project.created",
      entityType: "project",
      entityId: project.id,
      meta: JSON.stringify({ template: template.key }),
    },
  });

  return project;
}

export function seedExamplesForTemplate(template: ProjectTemplateDef) {
  // Only Quinable/healthcare ships default seed examples (must be reviewed).
  return template;
}
