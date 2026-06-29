"use client";

import { useCallback, useEffect, useState, use } from "react";
import { api, LABEL_LABELS, REASON_LABELS } from "@/lib/client";
import type { TrainingStatus } from "@/lib/training/status";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Textarea, Spinner } from "@/components/ui/primitives";
import { TierBadge } from "@/components/score";
import { Check, X, Radar, RefreshCw, Lock, Unlock } from "lucide-react";
import { LABEL_REASONS, LABEL_VALUES } from "@/lib/types";

type QueueItem = {
  id: string;
  name: string;
  website?: string | null;
  organizationType?: string | null;
  location?: string | null;
  tentativeScore?: number | null;
  priorityTier?: string | null;
  fitScore?: number | null;
  riskScore?: number | null;
  confidence?: number | null;
  painSignals: string[];
  riskSignals: string[];
  services: string[];
  evidence: { sourceName: string; url?: string | null; snippet?: string | null }[];
};

export default function TrainingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [status, setStatus] = useState<TrainingStatus | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [reasons, setReasons] = useState<string[]>([]);
  const [seedKind, setSeedKind] = useState<"positive" | "negative">("positive");
  const [seedText, setSeedText] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [s, q] = await Promise.all([
      api<TrainingStatus>(`/api/projects/${id}/training/status`),
      api<{ queue: QueueItem[] }>(`/api/projects/${id}/training/queue?limit=40`),
    ]);
    setStatus(s);
    setQueue(q.queue);
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const current = queue[0];

  async function runSampleScan() {
    setBusy("scan");
    setMsg(null);
    try {
      await api(`/api/projects/${id}/scans`, { method: "POST", body: JSON.stringify({ type: "sample", maxCandidates: 50 }) });
      await refresh();
      setMsg("Discovery sample scan complete — candidates added to the label queue.");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function label(value: string) {
    if (!current) return;
    setBusy("label");
    try {
      await api(`/api/projects/${id}/training/labels`, {
        method: "POST",
        body: JSON.stringify({ labels: [{ candidateId: current.id, label: value, reasons }] }),
      });
      setQueue((q) => q.slice(1));
      setReasons([]);
      const s = await api<TrainingStatus>(`/api/projects/${id}/training/status`);
      setStatus(s);
    } finally {
      setBusy(null);
    }
  }

  async function addSeeds() {
    const values = seedText.split(/[\n,]/).map((x) => x.trim()).filter(Boolean);
    if (values.length === 0) return;
    setBusy("seed");
    try {
      await api(`/api/projects/${id}/training/examples`, {
        method: "POST",
        body: JSON.stringify({ examples: values.map((v) => ({ kind: seedKind, inputType: "name", value: v })) }),
      });
      setSeedText("");
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  async function approveModel() {
    setBusy("approve");
    try {
      await api(`/api/projects/${id}/training/recompute`, { method: "POST" });
      await api(`/api/projects/${id}/training/approve-model`, { method: "POST", body: JSON.stringify({ approved: true }) });
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  if (!status) return <Spinner />;

  return (
    <div className="space-y-6">
      {/* Gate strip */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 p-4">
          <div className="flex items-center gap-2">
            {status.gate.canRunLargeScan ? <Unlock className="h-5 w-5 text-success" /> : <Lock className="h-5 w-5 text-amber-500" />}
            <span className="text-sm font-medium">
              {status.gate.metCount}/{status.gate.totalCount} requirements met
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {status.gate.requirements.map((r) => (
              <Badge key={r.key} tone={r.met ? "success" : "secondary"} className="gap-1">
                {r.met ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                {r.label}: {r.current}/{r.required}
              </Badge>
            ))}
          </div>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={refresh}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
            <Button size="sm" onClick={runSampleScan} disabled={busy === "scan"}>
              {busy === "scan" ? <Spinner /> : <Radar className="h-4 w-4" />} Run discovery sample
            </Button>
          </div>
        </CardContent>
      </Card>
      {msg && <p className="text-sm text-primary">{msg}</p>}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Seed examples */}
        <Card>
          <CardHeader>
            <CardTitle>1 · Seed examples</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Button size="sm" variant={seedKind === "positive" ? "success" : "outline"} onClick={() => setSeedKind("positive")}>
                Positive
              </Button>
              <Button size="sm" variant={seedKind === "negative" ? "destructive" : "outline"} onClick={() => setSeedKind("negative")}>
                Negative
              </Button>
            </div>
            <Textarea
              placeholder="One company/facility name or website per line"
              value={seedText}
              onChange={(e) => setSeedText(e.target.value)}
              rows={5}
            />
            <Button size="sm" onClick={addSeeds} disabled={busy === "seed"}>
              {busy === "seed" ? <Spinner /> : null} Add {seedKind} examples
            </Button>
            <div className="rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground">
              Seeds: <strong>{status.seedPositives}</strong> positive · <strong>{status.seedNegatives}</strong> negative. Seed examples count toward
              the label thresholds.
            </div>
          </CardContent>
        </Card>

        {/* Label queue */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>2 · Label queue ({queue.length} pending)</CardTitle>
          </CardHeader>
          <CardContent>
            {!current ? (
              <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                Queue is empty. Run a discovery sample scan to gather candidates to label.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-semibold">{current.name}</span>
                        <TierBadge tier={current.priorityTier} />
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {current.organizationType} · {current.location} · {current.website}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold tabular-nums">{current.tentativeScore ?? "—"}</div>
                      <div className="text-[11px] text-muted-foreground">priority</div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1">
                    {current.painSignals.map((s, i) => (
                      <Badge key={`p${i}`} tone="success" className="text-[10px]">
                        ⚑ {s}
                      </Badge>
                    ))}
                    {current.riskSignals.map((s, i) => (
                      <Badge key={`r${i}`} tone="destructive" className="text-[10px]">
                        ⚠ {s}
                      </Badge>
                    ))}
                    {current.services.slice(0, 4).map((s, i) => (
                      <Badge key={`s${i}`} tone="secondary" className="text-[10px]">
                        {s}
                      </Badge>
                    ))}
                  </div>

                  <div className="mt-3 space-y-1">
                    {current.evidence.slice(0, 3).map((e, i) => (
                      <div key={i} className="rounded border bg-muted/30 p-2 text-xs">
                        <span className="font-medium">{e.sourceName}</span>
                        {e.snippet ? <span className="text-muted-foreground"> — {e.snippet}</span> : null}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Reasons */}
                <div>
                  <div className="mb-1 text-xs font-medium text-muted-foreground">Reasons (optional)</div>
                  <div className="flex flex-wrap gap-1">
                    {LABEL_REASONS.map((r) => (
                      <button
                        key={r}
                        onClick={() => setReasons((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]))}
                        className={`rounded-full border px-2 py-0.5 text-xs ${reasons.includes(r) ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
                      >
                        {REASON_LABELS[r]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Label buttons */}
                <div className="flex flex-wrap gap-2">
                  {LABEL_VALUES.map((v) => (
                    <Button
                      key={v}
                      size="sm"
                      variant={v === "strong_fit" ? "success" : v === "not_a_fit" || v === "risky" ? "destructive" : "outline"}
                      onClick={() => label(v)}
                      disabled={busy === "label"}
                    >
                      {LABEL_LABELS[v]}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Model understanding + approve */}
      <Card>
        <CardHeader>
          <CardTitle>3 · Model Understanding (ICP lock)</CardTitle>
        </CardHeader>
        <CardContent>
          {!status.rubric ? (
            <p className="text-sm text-muted-foreground">Label some candidates, then recompute to generate the model rubric.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <RubricList title="A good target looks like" items={status.rubric.goodTargetLooksLike} tone="success" />
              <RubricList title="A bad target looks like" items={status.rubric.badTargetLooksLike} tone="destructive" />
              <RubricList title="Signals that increase score" items={status.rubric.signalsThatIncreaseScore} tone="success" />
              <RubricList title="Signals that decrease score" items={status.rubric.signalsThatDecreaseScore} tone="destructive" />
              <RubricList title="Known limitations" items={status.rubric.knownLimitations} tone="secondary" />
              <div className="rounded-md border p-3">
                <div className="text-sm font-semibold">Validation</div>
                {status.metrics ? (
                  <div className="mt-1 text-sm">
                    Precision <strong>{Math.round(status.metrics.precision * 100)}%</strong> · Recall{" "}
                    <strong>{Math.round(status.metrics.recall * 100)}%</strong> · sample {status.metrics.count}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No metrics yet</div>
                )}
                <div className="mt-3 flex items-center gap-2">
                  <Button size="sm" onClick={approveModel} disabled={busy === "approve"}>
                    {busy === "approve" ? <Spinner /> : <Check className="h-4 w-4" />}
                    {status.modelApproved ? "Re-approve model" : "Approve & lock ICP"}
                  </Button>
                  {status.modelApproved && <Badge tone="success">Approved</Badge>}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RubricList({ title, items, tone }: { title: string; items: string[]; tone: "success" | "destructive" | "secondary" }) {
  return (
    <div className="rounded-md border p-3">
      <div className="mb-1 text-sm font-semibold">{title}</div>
      <ul className="space-y-1 text-sm text-muted-foreground">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2">
            <span className={tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "text-muted-foreground"}>•</span>
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}
