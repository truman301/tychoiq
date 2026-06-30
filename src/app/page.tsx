import Link from "next/link";
import { prisma } from "@/lib/db";
import { Landing } from "@/components/Landing";
import { getSessionContext } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from "@/components/ui/primitives";
import { TierBadge } from "@/components/score";
import { parseJson } from "@/lib/json";
import { FolderPlus, Activity, GraduationCap, Trophy } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const ctx = await getSessionContext();
  if (!ctx) return <Landing />;
  const workspace = { id: ctx.workspaceId };

  const [projects, activeScans, topCandidates, totalCandidates] = await Promise.all([
    prisma.project.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { candidates: true, scanRuns: true, trainingEx: true } } },
    }),
    prisma.scanRun.findMany({
      where: { project: { workspaceId: workspace.id }, status: { in: ["queued", "running", "completed"] } },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { project: { select: { name: true, id: true } } },
    }),
    prisma.candidate.findMany({
      where: { project: { workspaceId: workspace.id } },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { scores: { orderBy: { createdAt: "desc" }, take: 1 }, project: { select: { id: true, name: true } } },
    }),
    prisma.candidate.count({ where: { project: { workspaceId: workspace.id } } }),
  ]);

  const sortedTop = topCandidates
    .map((c) => ({ c, p: c.scores[0]?.priorityScore ?? 0 }))
    .sort((a, b) => b.p - a.p)
    .map(({ c }) => c);

  const stats = [
    { label: "Projects", value: projects.length, icon: FolderPlus },
    { label: "Candidates", value: totalCandidates, icon: Trophy },
    { label: "Scan runs", value: projects.reduce((s, p) => s + p._count.scanRuns, 0), icon: Activity },
    { label: "Training examples", value: projects.reduce((s, p) => s + p._count.trainingEx, 0), icon: GraduationCap },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="AI-trained, evidence-first prospect discovery. Train before you scale."
        actions={
          <Link href="/projects/new">
            <Button>
              <FolderPlus className="h-4 w-4" /> New project
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                <s.icon className="h-5 w-5" />
              </span>
              <div>
                <div className="text-2xl font-bold tabular-nums">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Recent projects</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {projects.length === 0 ? (
                <EmptyProjects />
              ) : (
                projects.map((p) => (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    className="flex items-center justify-between rounded-md border p-3 transition-colors hover:bg-accent"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{p.name}</span>
                        {p.mode === "quinable" ? <Badge tone="success">Quinable</Badge> : <Badge tone="secondary">{p.mode}</Badge>}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {p.industry} · {p.geographySummary} · {p._count.candidates} candidates
                      </div>
                    </div>
                    <Badge tone={p.status === "ready" ? "success" : p.status === "scanning" ? "warning" : "secondary"}>{p.status}</Badge>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Active scan runs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {activeScans.length === 0 ? (
                <p className="text-sm text-muted-foreground">No scans yet.</p>
              ) : (
                activeScans.map((s) => {
                  const counts = parseJson<{ saved?: number }>(s.counts, {});
                  return (
                    <Link key={s.id} href={`/projects/${s.project.id}/scans`} className="block rounded-md border p-2 text-sm hover:bg-accent">
                      <div className="flex items-center justify-between">
                        <span className="truncate font-medium">{s.project.name}</span>
                        <Badge tone={s.status === "completed" ? "success" : "warning"}>{s.status}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {s.type} scan · {counts.saved ?? 0} candidates
                      </div>
                    </Link>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top candidates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {sortedTop.length === 0 ? (
                <p className="text-sm text-muted-foreground">Run a scan to surface candidates.</p>
              ) : (
                sortedTop.map((c) => (
                  <Link key={c.id} href={`/projects/${c.project.id}/candidates/${c.id}`} className="flex items-center justify-between rounded-md border p-2 text-sm hover:bg-accent">
                    <span className="truncate">{c.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums font-medium">{c.scores[0]?.priorityScore ?? 0}</span>
                      <TierBadge tier={c.priorityTier} />
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function EmptyProjects() {
  return (
    <div className="rounded-lg border border-dashed bg-starfield p-10 text-center">
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <FolderPlus className="h-5 w-5" />
      </div>
      <p className="text-sm font-medium">No projects yet</p>
      <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
        Create a sourcing project to define an ICP, train the model, and surface evidence-backed prospects.
      </p>
      <Link href="/projects/new" className="mt-4 inline-block">
        <Button>
          <FolderPlus className="h-4 w-4" /> Create your first project
        </Button>
      </Link>
      <p className="mx-auto mt-3 max-w-md text-xs text-muted-foreground">
        Tip: start with <strong>Quinable Mode</strong> for a ready-made healthcare-staffing template, or build a custom ICP from any of the seven project templates.
      </p>
    </div>
  );
}
