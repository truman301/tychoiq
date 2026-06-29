import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { getSessionContext, type SessionContext } from "@/lib/auth";

// Server-side access control for the multi-tenant (public) deployment.
// Every API route that touches workspace data must resolve the session and
// verify the target resource belongs to the caller's workspace.

export async function requireSession(): Promise<SessionContext> {
  const ctx = await getSessionContext();
  if (!ctx) throw new ApiError("Authentication required", 401);
  return ctx;
}

// Ensure a project belongs to the caller's workspace; returns it.
export async function assertProjectAccess(projectId: string) {
  const ctx = await requireSession();
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new ApiError("Project not found", 404);
  if (project.workspaceId !== ctx.workspaceId) throw new ApiError("Forbidden", 403);
  return { ctx, project };
}

export async function assertCandidateAccess(candidateId: string) {
  const ctx = await requireSession();
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    include: { project: { select: { workspaceId: true, id: true } } },
  });
  if (!candidate) throw new ApiError("Candidate not found", 404);
  if (candidate.project.workspaceId !== ctx.workspaceId) throw new ApiError("Forbidden", 403);
  return { ctx, candidate };
}

export async function assertScanAccess(scanId: string) {
  const ctx = await requireSession();
  const scan = await prisma.scanRun.findUnique({
    where: { id: scanId },
    include: { project: { select: { workspaceId: true, id: true } } },
  });
  if (!scan) throw new ApiError("Scan not found", 404);
  if (scan.project.workspaceId !== ctx.workspaceId) throw new ApiError("Forbidden", 403);
  return { ctx, scan };
}

export async function assertExportAccess(exportId: string) {
  const ctx = await requireSession();
  const job = await prisma.exportJob.findUnique({
    where: { id: exportId },
    include: { project: { select: { workspaceId: true } } },
  });
  if (!job) throw new ApiError("Export not found", 404);
  if (job.project.workspaceId !== ctx.workspaceId) throw new ApiError("Forbidden", 403);
  return { ctx, job };
}

// Bulk candidate access (bulk-label): all must be in the caller's workspace.
export async function assertCandidatesAccess(candidateIds: string[]) {
  const ctx = await requireSession();
  const candidates = await prisma.candidate.findMany({
    where: { id: { in: candidateIds } },
    include: { project: { select: { workspaceId: true } } },
  });
  const foreign = candidates.find((c) => c.project.workspaceId !== ctx.workspaceId);
  if (foreign) throw new ApiError("Forbidden", 403);
  return { ctx, candidates };
}
