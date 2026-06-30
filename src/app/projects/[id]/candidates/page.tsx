"use client";

import { useCallback, useEffect, useMemo, useState, use } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, LABEL_LABELS } from "@/lib/client";
import type { SerializedCandidate } from "@/lib/candidateView";
import { Card, CardContent, Button, Input, Badge, Spinner, Skeleton } from "@/components/ui/primitives";
import { TierBadge, ConfidenceDot } from "@/components/score";
import { LABEL_VALUES } from "@/lib/types";
import { Download, Upload, Tag } from "lucide-react";

export default function CandidatesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const search = useSearchParams();
  const [candidates, setCandidates] = useState<SerializedCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState({ tier: search.get("tier") ?? "", state: "", type: "", q: "" });
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const load = useCallback(async () => {
    setLoading(true);
    const data = await api<{ candidates: SerializedCandidate[] }>(`/api/projects/${id}/candidates`);
    setCandidates(data.candidates);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [filters]);

  const filtered = useMemo(() => {
    return candidates.filter((c) => {
      if (filters.tier && c.priorityTier !== filters.tier) return false;
      if (filters.state && !(c.locations ?? []).some((l) => (l.state ?? "").toLowerCase() === filters.state.toLowerCase())) return false;
      if (filters.type && !(c.organizationType ?? "").toLowerCase().includes(filters.type.toLowerCase())) return false;
      if (filters.q && !c.name.toLowerCase().includes(filters.q.toLowerCase())) return false;
      return true;
    });
  }, [candidates, filters]);

  function toggle(idc: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(idc)) n.delete(idc);
      else n.add(idc);
      return n;
    });
  }
  function toggleAll() {
    setSelected((s) => (s.size === filtered.length ? new Set() : new Set(filtered.map((c) => c.id))));
  }

  async function bulkLabel(label: string) {
    if (selected.size === 0) return;
    setBusy("label");
    try {
      await api(`/api/candidates/bulk-label`, { method: "POST", body: JSON.stringify({ candidateIds: [...selected], label }) });
      setSelected(new Set());
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function exportCsv(format: string) {
    setBusy("export");
    setMsg(null);
    try {
      const ids = selected.size ? [...selected] : undefined;
      const res = await api<{ id: string; rowCount: number; skipped: string[] }>(`/api/projects/${id}/exports`, {
        method: "POST",
        body: JSON.stringify({ format, candidateIds: ids, reviewedOnly: false }),
      });
      setMsg(`Exported ${res.rowCount} rows.`);
      window.open(`/api/exports/${res.id}`, "_blank");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function doImport() {
    setBusy("import");
    setMsg(null);
    try {
      const res = await api<{ imported: number }>(`/api/projects/${id}/candidates/import`, {
        method: "POST",
        body: JSON.stringify({ csv: importText }),
      });
      setMsg(`Imported ${res.imported} records.`);
      setImportText("");
      setImportOpen(false);
      await load();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pageCount);
  const visible = filtered.slice((current - 1) * pageSize, current * pageSize);
  const rangeStart = filtered.length === 0 ? 0 : (current - 1) * pageSize + 1;
  const rangeEnd = Math.min(current * pageSize, filtered.length);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Search name…" className="w-44" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
        <select className="h-9 rounded-md border bg-card px-2 text-sm" value={filters.tier} onChange={(e) => setFilters({ ...filters, tier: e.target.value })}>
          <option value="">All tiers</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
          <option value="avoid">Avoid</option>
        </select>
        <Input placeholder="State" className="w-20" value={filters.state} onChange={(e) => setFilters({ ...filters, state: e.target.value })} />
        <Input placeholder="Type" className="w-36" value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })} />
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setImportOpen((o) => !o)}>
            <Upload className="h-4 w-4" /> Import
          </Button>
          <Button size="sm" variant="outline" onClick={() => exportCsv("csv")} disabled={busy === "export"}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          <Button size="sm" variant="outline" onClick={() => exportCsv("quinable_csv")} disabled={busy === "export"}>
            <Download className="h-4 w-4" /> Quinable CSV
          </Button>
        </div>
      </div>

      {importOpen && (
        <Card>
          <CardContent className="space-y-2 p-4">
            <p className="text-sm text-muted-foreground">
              Paste CSV with a <code>name</code> column (plus optional website, address, city, state, phone). Records are scored through the full
              pipeline.
            </p>
            <textarea
              className="h-32 w-full rounded-md border bg-card p-2 font-mono text-xs"
              placeholder="name,website,city,state&#10;Acme Care Center,acmecare.com,Austin,TX"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
            />
            <Button size="sm" onClick={doImport} disabled={busy === "import"}>
              {busy === "import" ? <Spinner /> : null} Import & score
            </Button>
          </CardContent>
        </Card>
      )}

      {msg && <p className="text-sm text-primary">{msg}</p>}

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-accent/50 p-2 text-sm">
          <Tag className="h-4 w-4" />
          <span>{selected.size} selected</span>
          {LABEL_VALUES.map((v) => (
            <Button key={v} size="sm" variant="outline" onClick={() => bulkLabel(v)} disabled={busy === "label"}>
              {LABEL_LABELS[v]}
            </Button>
          ))}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="ml-auto h-4 w-10" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No candidates. Run a scan or import a list.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="p-2">
                      <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleAll} />
                    </th>
                    <th className="p-2">Name</th>
                    <th className="p-2">Type</th>
                    <th className="p-2">Location</th>
                    <th className="p-2 text-right">Priority</th>
                    <th className="p-2 text-right">Fit</th>
                    <th className="p-2 text-right">Risk</th>
                    <th className="p-2">Tier</th>
                    <th className="p-2">Conf.</th>
                    <th className="p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((c) => {
                    const loc = (c.locations ?? [])[0];
                    return (
                      <tr key={c.id} className="border-b last:border-0 hover:bg-accent/40">
                        <td className="p-2">
                          <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
                        </td>
                        <td className="p-2 font-medium">
                          <Link href={`/projects/${id}/candidates/${c.id}`} className="hover:text-primary hover:underline">
                            {c.name}
                          </Link>
                        </td>
                        <td className="p-2 text-muted-foreground">{c.organizationType ?? "—"}</td>
                        <td className="p-2 text-muted-foreground">{loc ? [loc.city, loc.state].filter(Boolean).join(", ") : "—"}</td>
                        <td className="p-2 text-right font-semibold tabular-nums">{c.score?.priorityScore ?? "—"}</td>
                        <td className="p-2 text-right tabular-nums">{c.score?.fitScore ?? "—"}</td>
                        <td className="p-2 text-right tabular-nums">{c.score?.riskScore ?? "—"}</td>
                        <td className="p-2">
                          <TierBadge tier={c.priorityTier} />
                        </td>
                        <td className="p-2">{c.score ? <ConfidenceDot confidence={c.score.confidence} /> : "—"}</td>
                        <td className="p-2">
                          <Badge tone={c.reviewed ? "success" : "secondary"}>{c.status}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {filtered.length === 0 ? "No candidates" : `Showing ${rangeStart}–${rangeEnd} of ${filtered.length}`}
          {filtered.length !== candidates.length ? ` (filtered from ${candidates.length})` : ""}
        </p>
        {pageCount > 1 && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={current <= 1}>
              Previous
            </Button>
            <span className="text-xs tabular-nums text-muted-foreground">
              Page {current} of {pageCount}
            </span>
            <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={current >= pageCount}>
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
