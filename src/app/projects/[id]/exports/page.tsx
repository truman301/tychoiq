"use client";

import { useCallback, useEffect, useState, use } from "react";
import { api } from "@/lib/client";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Spinner } from "@/components/ui/primitives";
import { Download } from "lucide-react";

type ExportJob = { id: string; format: string; fileName: string; rowCount: number; status: string; createdAt: string };

const FORMATS = [
  { key: "csv", label: "General CSV", desc: "All scored fields + evidence URLs" },
  { key: "quinable_csv", label: "Quinable CSV", desc: "Healthcare fields: CCN, NPI, beds, outreach angle" },
  { key: "clay_csv", label: "Clay-compatible CSV", desc: "Flat columns for Clay enrichment" },
  { key: "json", label: "JSON", desc: "Structured JSON export" },
];

export default function ExportsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [jobs, setJobs] = useState<ExportJob[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [reviewedOnly, setReviewedOnly] = useState(true);

  const load = useCallback(async () => {
    setJobs(await api<ExportJob[]>(`/api/projects/${id}/exports`));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function run(format: string) {
    setBusy(format);
    setMsg(null);
    try {
      const res = await api<{ id: string; fileName: string; rowCount: number; skipped: string[] }>(`/api/projects/${id}/exports`, {
        method: "POST",
        body: JSON.stringify({ format, reviewedOnly }),
      });
      setMsg(`Built ${res.fileName ?? "export"} (${res.rowCount} rows)${res.skipped?.length ? `, skipped ${res.skipped.length} by export gate` : ""}.`);
      window.open(`/api/exports/${res.id}`, "_blank");
      await load();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Export & integrations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={reviewedOnly} onChange={(e) => setReviewedOnly(e.target.checked)} />
            Apply export gate: only reviewed or high-confidence candidates with source URLs (recommended).
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            {FORMATS.map((f) => (
              <div key={f.key} className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <div className="text-sm font-medium">{f.label}</div>
                  <div className="text-xs text-muted-foreground">{f.desc}</div>
                </div>
                <Button size="sm" onClick={() => run(f.key)} disabled={busy === f.key}>
                  {busy === f.key ? <Spinner /> : <Download className="h-4 w-4" />} Build
                </Button>
              </div>
            ))}
          </div>
          {msg && <p className="text-sm text-primary">{msg}</p>}
          <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
            <strong>CRM integration mapping (mock):</strong> HubSpot ⟶ Company (name, domain, city, state), custom props for priority/fit/risk.
            Salesforce ⟶ Account (Name, Website, BillingState) + custom Priority_Score__c. Apollo/ZoomInfo ⟶ import the General CSV and map
            company name + domain. No live CRM writes in MVP (human-review-before-outreach).
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Export history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No exports yet.</p>
          ) : (
            jobs.map((j) => (
              <div key={j.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                <span>
                  <Badge tone="secondary">{j.format}</Badge> <span className="ml-2">{j.fileName}</span>
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{j.rowCount} rows</span>
                  <a href={`/api/exports/${j.id}`} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                    Download
                  </a>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
