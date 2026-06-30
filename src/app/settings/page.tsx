"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Spinner } from "@/components/ui/primitives";

type Connector = { id: string; key: string; name: string; category: string; enabled: boolean; mock: boolean };
type SettingsData = {
  connectors: Connector[];
  mockMode: boolean;
  llmProvider: string;
  embeddingsProvider: string;
  keyAvailable: Record<string, boolean>;
};

export default function SettingsPage() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<SettingsData>("/api/settings/connectors").then(setData);
  }, []);

  async function toggle(key: string, enabled: boolean) {
    if (!data) return;
    setBusy(true);
    try {
      await api("/api/settings/connectors", { method: "PATCH", body: JSON.stringify({ connectors: [{ key, enabled }] }) });
      setData({ ...data, connectors: data.connectors.map((c) => (c.key === key ? { ...c, enabled } : c)) });
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <Spinner />;

  return (
    <div>
      <PageHeader title="Settings" description="Source connectors, providers, and compliance posture." />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Source connectors</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.connectors.map((c) => {
              const hasKey = data.keyAvailable[c.key];
              return (
                <div key={c.id} className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {c.name}
                      <Badge tone="secondary">{c.category}</Badge>
                      {data.mockMode || !hasKey ? <Badge tone="warning">Sample data</Badge> : <Badge tone="success">Live</Badge>}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {data.mockMode || !hasKey ? "Returning bundled sample results" : "Connected to live source"}
                    </div>
                  </div>
                  <Button size="sm" variant={c.enabled ? "success" : "outline"} onClick={() => toggle(c.key, !c.enabled)} disabled={busy}>
                    {c.enabled ? "Enabled" : "Disabled"}
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Providers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Data mode" value={data.mockMode ? "Sample (no keys required)" : "Live"} />
              <Row label="Language model" value={providerLabel(data.llmProvider)} />
              <Row label="Embeddings" value={providerLabel(data.embeddingsProvider)} />
              <p className="pt-2 text-xs text-muted-foreground">
                This workspace is running on bundled sample data. Add data-source and model API keys to switch to live results.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Compliance posture</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-xs text-muted-foreground">
              <p>✓ Public data only (or your own authorized uploads)</p>
              <p>✓ Respects robots.txt; no login/paywall/CAPTCHA bypass</p>
              <p>✓ Rate-limited per domain; stores source URLs + timestamps</p>
              <p>✓ No patient/PHI data; organization-level only</p>
              <p>✓ Human review required before outreach export</p>
              <p>✓ Protected-class attributes excluded from scoring</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function providerLabel(v: string) {
  return v === "mock" ? "Sample" : v;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
