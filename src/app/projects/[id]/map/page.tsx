"use client";

import { useEffect, useMemo, useState, use } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import type { SerializedCandidate } from "@/lib/candidateView";
import { Card, CardContent, CardHeader, CardTitle, Badge, Spinner } from "@/components/ui/primitives";
import { MiniMap, type MapPoint } from "@/components/MiniMap";

export default function MapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [candidates, setCandidates] = useState<SerializedCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState("");

  useEffect(() => {
    api<{ candidates: SerializedCandidate[] }>(`/api/projects/${id}/candidates`).then((d) => {
      setCandidates(d.candidates);
      setLoading(false);
    });
  }, [id]);

  const filtered = tier ? candidates.filter((c) => c.priorityTier === tier) : candidates;

  const points: (MapPoint & { candidateId: string })[] = useMemo(() => {
    const pts: (MapPoint & { candidateId: string })[] = [];
    for (const c of filtered) {
      const loc = (c.locations ?? []).find((l) => l.latitude != null && l.longitude != null);
      if (loc) pts.push({ lat: loc.latitude as number, lng: loc.longitude as number, label: c.name, tier: c.priorityTier, score: c.score?.priorityScore, candidateId: c.id });
    }
    return pts;
  }, [filtered]);

  // market density by state
  const density = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of filtered) {
      const st = (c.locations ?? [])[0]?.state;
      if (st) m[st] = (m[st] ?? 0) + 1;
    }
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  if (loading) return <Spinner />;

  return (
    <div className="grid gap-4 lg:grid-cols-4">
      <div className="lg:col-span-3">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Market map ({points.length} plotted)</CardTitle>
            <select className="h-8 rounded-md border bg-card px-2 text-sm" value={tier} onChange={(e) => setTier(e.target.value)}>
              <option value="">All tiers</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
              <option value="avoid">Avoid</option>
            </select>
          </CardHeader>
          <CardContent>
            <MiniMap points={points} className="h-[460px]" />
            <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
              <span><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: "#0E9F6E" }} />High</span>
              <span><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: "#5B4FE0" }} />Medium</span>
              <span><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: "#94a3b8" }} />Low</span>
              <span><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: "#E11D48" }} />Avoid</span>
              <span className="ml-auto">Bubble size = priority score</span>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Market density</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {density.length === 0 ? (
              <p className="text-sm text-muted-foreground">No located candidates.</p>
            ) : (
              density.map(([st, n]) => (
                <div key={st} className="flex items-center justify-between text-sm">
                  <span>{st}</span>
                  <Badge tone="secondary">{n}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top in view</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {filtered
              .slice()
              .sort((a, b) => (b.score?.priorityScore ?? 0) - (a.score?.priorityScore ?? 0))
              .slice(0, 8)
              .map((c) => (
                <Link key={c.id} href={`/projects/${id}/candidates/${c.id}`} className="flex items-center justify-between rounded border p-1.5 text-sm hover:bg-accent">
                  <span className="truncate">{c.name}</span>
                  <span className="tabular-nums font-medium">{c.score?.priorityScore ?? 0}</span>
                </Link>
              ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
