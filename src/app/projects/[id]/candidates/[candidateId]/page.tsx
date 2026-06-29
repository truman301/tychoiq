"use client";

import { useCallback, useEffect, useState, use } from "react";
import Link from "next/link";
import { api, LABEL_LABELS } from "@/lib/client";
import type { SerializedCandidate } from "@/lib/candidateView";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Input, Spinner } from "@/components/ui/primitives";
import { TierBadge, ScorePill, ScoreBar, ConfidenceDot } from "@/components/score";
import { MiniMap } from "@/components/MiniMap";
import { LABEL_VALUES } from "@/lib/types";
import { ChevronLeft, ExternalLink } from "lucide-react";

const TABS = ["Overview", "Evidence", "Score breakdown", "Locations", "Contacts", "Risk analysis", "Outreach", "Activity"] as const;

export default function CandidateDetail({ params }: { params: Promise<{ id: string; candidateId: string }> }) {
  const { id, candidateId } = use(params);
  const [c, setC] = useState<SerializedCandidate | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const data = await api<SerializedCandidate>(`/api/candidates/${candidateId}`);
    setC(data);
    setNotes(data.notes ?? "");
  }, [candidateId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!c) return <Spinner />;
  const s = c.score;

  async function label(v: string) {
    setBusy(true);
    try {
      await api(`/api/candidates/${candidateId}/label`, { method: "POST", body: JSON.stringify({ label: v }) });
      await load();
    } finally {
      setBusy(false);
    }
  }
  async function saveNotes() {
    setBusy(true);
    try {
      await api(`/api/candidates/${candidateId}`, { method: "PATCH", body: JSON.stringify({ notes }) });
    } finally {
      setBusy(false);
    }
  }
  async function markContacted() {
    setBusy(true);
    try {
      await api(`/api/candidates/${candidateId}`, { method: "PATCH", body: JSON.stringify({ contacted: true, status: "contacted" }) });
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Link href={`/projects/${id}/candidates`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-3 w-3" /> Back to candidates
      </Link>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Header card */}
        <Card className="lg:col-span-2">
          <CardContent className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold">{c.name}</h2>
                  <TierBadge tier={c.priorityTier} />
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {c.organizationType ?? "Unknown type"}
                  {c.parentCompany ? ` · part of ${c.parentCompany}` : ""}
                  {c.website ? (
                    <>
                      {" · "}
                      <a href={c.website.startsWith("http") ? c.website : `https://${c.website}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                        {c.website} <ExternalLink className="h-3 w-3" />
                      </a>
                    </>
                  ) : null}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {c.ccn && <Badge tone="secondary">CCN {c.ccn}</Badge>}
                  {c.npi && <Badge tone="secondary">NPI {c.npi}</Badge>}
                  {typeof c.bedCount === "number" && <Badge tone="secondary">{c.bedCount} beds</Badge>}
                  {typeof c.starRating === "number" && <Badge tone="secondary">{c.starRating}★ CMS</Badge>}
                  {typeof c.facilityCountEstimate === "number" && <Badge tone="secondary">~{c.facilityCountEstimate} sites</Badge>}
                </div>
              </div>
              {s && (
                <div className="flex gap-2">
                  <ScorePill score={s.priorityScore} label="Priority" />
                  <ScorePill score={s.fitScore} label="Fit" />
                  <ScorePill score={s.riskScore} label="Risk" />
                </div>
              )}
            </div>
            {s && (
              <div className="mt-3">
                <ConfidenceDot confidence={s.confidence} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-1">
              {LABEL_VALUES.map((v) => (
                <Button key={v} size="sm" variant="outline" onClick={() => label(v)} disabled={busy}>
                  {LABEL_LABELS[v]}
                </Button>
              ))}
            </div>
            <Button size="sm" onClick={markContacted} disabled={busy || c.contacted}>
              {c.contacted ? "Marked contacted" : "Mark as contacted"}
            </Button>
            <div>
              <Input placeholder="Add a note…" value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={saveNotes} />
            </div>
            {s && (
              <div className="rounded-md border bg-muted/30 p-2 text-xs">
                Recommended next action: <strong className="capitalize">{s.recommendedNextAction}</strong>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && <Overview c={c} />}
      {tab === "Evidence" && <Evidence c={c} />}
      {tab === "Score breakdown" && <Breakdown c={c} />}
      {tab === "Locations" && <Locations c={c} />}
      {tab === "Contacts" && <Contacts c={c} />}
      {tab === "Risk analysis" && <RiskAnalysis c={c} />}
      {tab === "Outreach" && <Outreach c={c} />}
      {tab === "Activity" && <Activity c={c} />}
    </div>
  );
}

function Overview({ c }: { c: SerializedCandidate }) {
  const s = c.score;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Why this account may be worth targeting</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1 text-sm">
            {(s?.topReasonsToTarget ?? []).length === 0 ? (
              <li className="text-muted-foreground">No positive evidence captured.</li>
            ) : (
              s!.topReasonsToTarget.map((r, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-success">✓</span>
                  {r}
                </li>
              ))
            )}
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Risks or reasons to avoid</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1 text-sm">
            {(s?.topReasonsToAvoid ?? []).length === 0 ? <li className="text-muted-foreground">No risk signals detected.</li> : null}
            {s?.topReasonsToAvoid.map((r, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-destructive">⚠</span>
                {r}
              </li>
            ))}
            {s?.missingInfo.map((r, i) => (
              <li key={`m${i}`} className="flex gap-2 text-muted-foreground">
                <span>?</span>
                {r}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Description & services</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{c.description ?? "No description extracted."}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {c.services.map((sv, i) => (
              <Badge key={i} tone="secondary">
                {sv}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Evidence({ c }: { c: SerializedCandidate }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Evidence ({c.evidence.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {c.evidence.length === 0 ? (
          <p className="text-sm text-muted-foreground">No evidence.</p>
        ) : (
          c.evidence.map((e, i) => (
            <div key={i} className="rounded-md border p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{e.sourceName}</span>
                <div className="flex items-center gap-2">
                  <Badge tone="secondary">{e.field}</Badge>
                  <Badge tone={e.confidence === "high" ? "success" : e.confidence === "low" ? "destructive" : "default"}>{e.confidence}</Badge>
                </div>
              </div>
              {e.snippet ? <p className="mt-1 text-muted-foreground">“{e.snippet}”</p> : null}
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <span>{e.sourceType}</span>
                {e.url ? (
                  <a href={e.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                    {e.url} <ExternalLink className="h-3 w-3" />
                  </a>
                ) : null}
                <span>· retrieved {new Date(e.retrievedAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function Breakdown({ c }: { c: SerializedCandidate }) {
  const s = c.score;
  if (!s) return <p className="text-sm text-muted-foreground">No score.</p>;
  const fit = Object.entries(s.scoreBreakdown).filter(([k]) => k.startsWith("fit."));
  const risk = Object.entries(s.scoreBreakdown).filter(([k]) => k.startsWith("risk."));
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fit components → {s.fitScore}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {fit.map(([k, v]) => (
            <ScoreBar key={k} label={k.replace("fit.", "").replace(/_/g, " ")} value={v} max={25} />
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Risk components → {s.riskScore}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {risk.map(([k, v]) => (
            <ScoreBar key={k} label={k.replace("risk.", "").replace(/_/g, " ")} value={v} max={30} tone="risk" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Locations({ c }: { c: SerializedCandidate }) {
  const pts = (c.locations ?? [])
    .filter((l) => l.latitude != null && l.longitude != null)
    .map((l) => ({ lat: l.latitude as number, lng: l.longitude as number, label: [l.city, l.state].filter(Boolean).join(", ") }));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Locations</CardTitle>
      </CardHeader>
      <CardContent>
        {pts.length > 0 && <MiniMap points={pts} className="mb-3 h-56" />}
        <div className="space-y-2">
          {c.locations.map((l, i) => (
            <div key={i} className="rounded-md border p-2 text-sm">
              {l.isHeadquarters && <Badge tone="default" className="mr-2">HQ</Badge>}
              {[l.address, l.city, l.state, l.postalCode].filter(Boolean).join(", ") || "Location"}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function Contacts({ c }: { c: SerializedCandidate }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Contacts & recommended titles</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="mb-1 text-xs font-medium text-muted-foreground">Recommended decision-maker titles</div>
          <div className="flex flex-wrap gap-1">
            {c.recommendedTitles.map((t, i) => (
              <Badge key={i} tone="default">
                {t}
              </Badge>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          {c.contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No named contacts (minimize personal data; titles only by default).</p>
          ) : (
            c.contacts.map((ct, i) => (
              <div key={i} className="rounded-md border p-2 text-sm">
                {ct.name ?? "—"} · {ct.title ?? ""} {ct.email ? `· ${ct.email}` : ""}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function RiskAnalysis({ c }: { c: SerializedCandidate }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Risk signals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {c.riskSignals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No risk signals detected.</p>
          ) : (
            c.riskSignals.map((sig, i) => (
              <div key={i} className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-sm">
                <span className="font-medium capitalize">{sig.type.replace(/_/g, " ")}</span>
                {sig.evidence?.snippet ? <p className="text-xs text-muted-foreground">“{sig.evidence.snippet}”</p> : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quality signals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {c.qualitySignals.map((sig, i) => (
            <div key={i} className="rounded-md border border-success/30 bg-success/5 p-2 text-sm">
              <span className="font-medium capitalize">{sig.type.replace(/_/g, " ")}</span>
              {sig.evidence?.snippet ? <p className="text-xs text-muted-foreground">“{sig.evidence.snippet}”</p> : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Outreach({ c }: { c: SerializedCandidate }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Best outreach angle</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm">{c.outreachAngle ?? "No outreach angle generated."}</p>
        <div className="mt-3 text-xs text-muted-foreground">
          Reach out to: {c.recommendedTitles.join(", ")}
        </div>
        <div className="mt-3 rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground">
          Human review required before any outreach export (compliance §8). No automated outreach blasts in MVP.
        </div>
      </CardContent>
    </Card>
  );
}

function Activity({ c }: { c: SerializedCandidate }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Label history</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {c.labels.length === 0 ? (
          <p className="text-sm text-muted-foreground">No labels yet.</p>
        ) : (
          c.labels.map((l, i) => (
            <div key={i} className="flex items-center justify-between rounded-md border p-2 text-sm">
              <span>
                <Badge tone="default">{LABEL_LABELS[l.label] ?? l.label}</Badge>
                {l.reasons.length ? <span className="ml-2 text-xs text-muted-foreground">{l.reasons.join(", ")}</span> : null}
              </span>
              <span className="text-xs text-muted-foreground">{new Date(l.createdAt).toLocaleString()}</span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
