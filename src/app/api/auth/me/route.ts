import { prisma } from "@/lib/db";
import { ok, handleError } from "@/lib/api";
import { getSessionContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ctx = await getSessionContext();
    if (!ctx) return ok(null);
    const workspace = await prisma.workspace.findUnique({ where: { id: ctx.workspaceId }, select: { id: true, name: true } });
    return ok({ user: { id: ctx.user.id, email: ctx.user.email, name: ctx.user.name }, workspace });
  } catch (err) {
    return handleError(err);
  }
}
