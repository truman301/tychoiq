import { prisma } from "@/lib/db";
import { stringifyJson } from "@/lib/json";
import type { LabelValue } from "@/lib/types";

export type ApplyLabelInput = {
  projectId: string;
  candidateId: string;
  label: LabelValue;
  reasons?: string[];
  note?: string;
  source?: "training" | "review" | "bulk";
  isHoldout?: boolean;
  createdBy?: string;
};

function statusForLabel(label: LabelValue): { status: string; reviewed: boolean; tier?: string } {
  switch (label) {
    case "duplicate":
      return { status: "archived", reviewed: true };
    case "risky":
      return { status: "reviewed", reviewed: true, tier: "avoid" };
    case "not_a_fit":
      return { status: "reviewed", reviewed: true, tier: "low" };
    case "needs_research":
      return { status: "needs_review", reviewed: false };
    default:
      return { status: "reviewed", reviewed: true };
  }
}

export async function applyLabel(input: ApplyLabelInput) {
  const label = await prisma.candidateLabel.create({
    data: {
      projectId: input.projectId,
      candidateId: input.candidateId,
      label: input.label,
      reasons: input.reasons ? stringifyJson(input.reasons) : null,
      note: input.note,
      source: input.source ?? "review",
      isHoldout: input.isHoldout ?? false,
      createdBy: input.createdBy,
    },
  });

  const s = statusForLabel(input.label);
  await prisma.candidate.update({
    where: { id: input.candidateId },
    data: { status: s.status, reviewed: s.reviewed, priorityTier: s.tier ?? undefined },
  });

  await prisma.auditLog.create({
    data: {
      projectId: input.projectId,
      actor: input.createdBy,
      action: "candidate.labeled",
      entityType: "candidate",
      entityId: input.candidateId,
      meta: stringifyJson({ label: input.label, reasons: input.reasons }),
    },
  });

  return label;
}
