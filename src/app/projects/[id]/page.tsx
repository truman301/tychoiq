import Link from "next/link";
import { prisma } from "@/lib/db";
import { getTrainingStatus } from "@/lib/training/status";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from "@/components/ui/primitives";
import { Check, X, GraduationCap, Radar, Table2, Settings2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ProjectOverview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [project, status, counts] = await Promise.all([
    prisma.project.findUnique({ where: { id }, include: { icp: true } }),
    getTrainingStatus(id),
    prisma.candidate.groupBy({ by: ["priorityTier"], where: { projectId: id }, _count: true }),
  ]);
  if (!project) return null;

  const tierCounts: Record<string, number> = {};
  for (const c of counts) tierCounts[c.priorityTier ?? "unscored"] = c._count;
  const totalCandidates = Object.values(tierCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Training gate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {status.gate.metCount}/{status.gate.totalCount} requirements met
              </span>
              <Badge tone={status.gate.canRunLargeScan ? "success" : "warning"}>
                {status.gate.canRunLargeScan ? "Ready for large scan" : "Locked"}
              </Badge>
            </div>
            <ul className="space-y-2">
              {status.gate.requirements.map((r) => (
                <li key={r.key} className="flex items-center justify-between rounded-md border p-2 text-sm">
                  <span className="flex items-center gap-2">
                    {r.met ? <Check className="h-4 w-4 text-success" /> : <X className="h-4 w-4 text-destructive" />}
                    {r.label}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {r.current} / {r.required}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={`/projects/${id}/training`}>
                <Button size="sm">
                  <GraduationCap className="h-4 w-4" /> Open Training Center
                </Button>
              </Link>
              <Link href={`/projects/${id}/scans`}>
                <Button size="sm" variant="outline">
                  <Radar className="h-4 w-4" /> Scan runs
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Candidate pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            {totalCandidates === 0 ? (
              <p className="text-sm text-muted-foreground">
                No candidates yet. Run a discovery sample scan from the Scan Runs tab to gather candidates for labeling.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(["high", "medium", "low", "avoid"] as const).map((tier) => (
                  <Link
                    key={tier}
                    href={`/projects/${id}/candidates?tier=${tier}`}
                    className="rounded-md border p-3 transition-colors hover:bg-accent"
                  >
                    <div className="text-2xl font-bold tabular-nums">{tierCounts[tier] ?? 0}</div>
                    <div className="text-xs capitalize text-muted-foreground">{tier}</div>
                  </Link>
                ))}
              </div>
            )}
            <Link href={`/projects/${id}/candidates`} className="mt-4 inline-block">
              <Button size="sm" variant="outline">
                <Table2 className="h-4 w-4" /> View candidates ({totalCandidates})
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Validation metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {status.metrics ? (
              <>
                <Row label="Precision" value={`${Math.round(status.metrics.precision * 100)}%`} target={`${project.validationThreshold}%`} />
                <Row label="Recall" value={`${Math.round(status.metrics.recall * 100)}%`} />
                <Row label="F1" value={status.metrics.f1.toFixed(2)} />
                <Row label="Labeled sample" value={String(status.metrics.count)} />
              </>
            ) : (
              <p className="text-muted-foreground">No labels yet — label candidates to compute precision.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick links</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href={`/projects/${id}/icp`} className="flex items-center gap-2 rounded-md border p-2 text-sm hover:bg-accent">
              <Settings2 className="h-4 w-4" /> Edit ICP & scoring weights
            </Link>
            <Link href={`/projects/${id}/exports`} className="flex items-center gap-2 rounded-md border p-2 text-sm hover:bg-accent">
              <Table2 className="h-4 w-4" /> Exports & integrations
            </Link>
            <Link href={`/settings`} className="flex items-center gap-2 rounded-md border p-2 text-sm hover:bg-accent">
              <Settings2 className="h-4 w-4" /> Source connectors
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value, target }: { label: string; value: string; target?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums font-medium">
        {value}
        {target ? <span className="ml-1 text-xs text-muted-foreground">/ {target}</span> : null}
      </span>
    </div>
  );
}
