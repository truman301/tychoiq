"use client";

import { useCallback, useEffect, useState, use } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Input, Label, Spinner } from "@/components/ui/primitives";
import { Radar, AlertTriangle } from "lucide-react";

type Scan = {
  id: string;
  type: string;
  status: string;
  regionSummary?: string | null;
  counts?: string | null;
  createdAt: string;
  _count?: { candidates: number; logs: number };
};

export default function ScansPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [scans, setScans] = useState<Scan[]>([]);
  const [maxCandidates, setMax] = useState(50);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gateInfo, setGateInfo] = useState<unknown>(null);
  const [override, setOverride] = useState(false);

  const refresh = useCallback(async () => {
    setScans(await api<Scan[]>(`/api/projects/${id}/scans`));
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function run(type: "sample" | "large") {
    setBusy(type);
    setError(null);
    setGateInfo(null);
    try {
      await api(`/api/projects/${id}/scans`, {
        method: "POST",
        body: JSON.stringify({ type, maxCandidates, override: type === "large" ? override : undefined }),
      });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
      setGateInfo((e as Error & { details?: unknown }).details);
    } finally {
      setBusy(null);
    }
  }

  function counts(s: Scan) {
    try {
      return JSON.parse(s.counts ?? "{}");
    } catch {
      return {};
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Run a scan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label>Max candidates</Label>
              <Input type="number" className="w-28" value={maxCandidates} onChange={(e) => setMax(Number(e.target.value) || 50)} />
            </div>
            <Button onClick={() => run("sample")} disabled={busy === "sample"}>
              {busy === "sample" ? <Spinner /> : <Radar className="h-4 w-4" />} Discovery sample scan
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => run("large")} disabled={busy === "large"}>
                {busy === "large" ? <Spinner /> : null} Large regional scan
              </Button>
              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} /> admin override
              </label>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Sample scans gather candidates for labeling (no gate). Large scans are blocked until training requirements are met (spec §9). Mock mode is
            used when no API keys are configured.
          </p>
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div>{error}</div>
                {gateInfo ? <pre className="mt-1 max-w-full overflow-x-auto text-[11px] opacity-80">{JSON.stringify(gateInfo, null, 2)}</pre> : null}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scan history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {scans.length === 0 ? (
            <p className="text-sm text-muted-foreground">No scans yet.</p>
          ) : (
            scans.map((s) => {
              const c = counts(s);
              return (
                <Link
                  key={s.id}
                  href={`/projects/${id}/candidates?scan=${s.id}`}
                  className="flex items-center justify-between rounded-md border p-3 text-sm transition-colors hover:bg-accent"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge tone={s.type === "large" ? "default" : "secondary"}>{s.type}</Badge>
                      <Badge tone={s.status === "completed" ? "success" : s.status === "failed" ? "destructive" : "warning"}>{s.status}</Badge>
                      <span className="text-xs text-muted-foreground">{new Date(s.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {s.regionSummary} · discovered {c.discovered ?? 0} → {c.deduped ?? 0} unique → {c.saved ?? 0} saved · {c.queuedForReview ?? 0} queued
                      for review
                    </div>
                  </div>
                  <span className="text-xs font-medium text-primary">{s._count?.candidates ?? 0} candidates →</span>
                </Link>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
