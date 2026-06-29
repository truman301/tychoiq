import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";
import { ProjectTabs } from "@/components/ProjectTabs";
import { Badge } from "@/components/ui/primitives";
import { ChevronLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) notFound();
  if (project.workspaceId !== ctx.workspaceId) notFound();

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <Link href="/" className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-3 w-3" /> All projects
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight">{project.name}</h1>
            {project.mode === "quinable" ? <Badge tone="success">Quinable Mode</Badge> : <Badge tone="secondary">{project.mode}</Badge>}
            <Badge tone={project.scanUnlocked ? "success" : "warning"}>
              {project.scanUnlocked ? "Large scan unlocked" : "Large scan locked"}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {project.industry} · {project.geographySummary}
          </p>
        </div>
      </div>

      <ProjectTabs projectId={id} />
      {children}
    </div>
  );
}
