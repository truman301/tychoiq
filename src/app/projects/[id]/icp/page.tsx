"use client";

import { useEffect, useState, use } from "react";
import { api } from "@/lib/client";
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label, Textarea, Badge, Spinner } from "@/components/ui/primitives";
import type { IcpData } from "@/lib/types";

const toLines = (arr: string[]) => (arr ?? []).join("\n");
const fromLines = (s: string) => s.split(/[\n,]/).map((x) => x.trim()).filter(Boolean);

export default function IcpPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [icp, setIcp] = useState<IcpData | null>(null);
  const [mode, setMode] = useState<string>("general");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ icpData: IcpData; mode: string }>(`/api/projects/${id}`).then((p) => {
      setIcp(p.icpData);
      setMode(p.mode);
    });
  }, [id]);

  if (!icp) return <Spinner />;

  function update<K extends keyof IcpData>(key: K, value: IcpData[K]) {
    setIcp((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function save() {
    if (!icp) return;
    setSaving(true);
    setError(null);
    try {
      await api(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify({ icp }) });
      setSavedAt(new Date().toLocaleTimeString());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const weightSum = (w: Record<string, number>) => Object.values(w).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          The ICP drives query generation, scoring, and the training rubric. Evidence-first by design.
        </p>
        <div className="flex items-center gap-3">
          {savedAt && <span className="text-xs text-success">Saved {savedAt}</span>}
          <Button onClick={save} disabled={saving}>
            {saving ? <Spinner /> : null} Save ICP
          </Button>
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Target & geography</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Target description">
              <Textarea value={icp.targetDescription} onChange={(e) => update("targetDescription", e.target.value)} />
            </Field>
            <Field label="Target states (e.g. MI, TX, OH)">
              <Input
                value={(icp.geography.states ?? []).join(", ")}
                onChange={(e) => update("geography", { ...icp.geography, states: fromLines(e.target.value) })}
              />
            </Field>
            <Field label="Target cities (optional)">
              <Input
                value={(icp.geography.cities ?? []).join(", ")}
                onChange={(e) => update("geography", { ...icp.geography, cities: fromLines(e.target.value) })}
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Categories</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Include organization types (one per line)">
              <Textarea value={toLines(icp.organizationTypesInclude)} onChange={(e) => update("organizationTypesInclude", fromLines(e.target.value))} />
            </Field>
            <Field label="Exclude organization types">
              <Textarea value={toLines(icp.organizationTypesExclude)} onChange={(e) => update("organizationTypesExclude", fromLines(e.target.value))} />
            </Field>
            <Field label="Optional / adjacent categories">
              <Textarea value={toLines(icp.optionalCategories)} onChange={(e) => update("optionalCategories", fromLines(e.target.value))} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Signals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Pain / staffing-need signals">
              <Textarea value={toLines(icp.painSignals)} onChange={(e) => update("painSignals", fromLines(e.target.value))} />
            </Field>
            <Field label="Quality signals">
              <Textarea value={toLines(icp.qualitySignals)} onChange={(e) => update("qualitySignals", fromLines(e.target.value))} />
            </Field>
            <Field label="Risk signals">
              <Textarea value={toLines(icp.riskSignals)} onChange={(e) => update("riskSignals", fromLines(e.target.value))} />
            </Field>
            <Field label="Trigger events">
              <Textarea value={toLines(icp.triggerEvents)} onChange={(e) => update("triggerEvents", fromLines(e.target.value))} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Size, personas & sources</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Min locations">
                <Input type="number" value={icp.sizeSignals.minLocations ?? ""} onChange={(e) => update("sizeSignals", { ...icp.sizeSignals, minLocations: Number(e.target.value) || undefined })} />
              </Field>
              <Field label="Min employees">
                <Input type="number" value={icp.sizeSignals.minEmployees ?? ""} onChange={(e) => update("sizeSignals", { ...icp.sizeSignals, minEmployees: Number(e.target.value) || undefined })} />
              </Field>
            </div>
            <Field label="Buyer persona titles">
              <Textarea value={toLines(icp.buyerPersonaTitles)} onChange={(e) => update("buyerPersonaTitles", fromLines(e.target.value))} />
            </Field>
            <Field label="Source preferences (connector keys)">
              <Textarea value={toLines(icp.sourcePreferences)} onChange={(e) => update("sourcePreferences", fromLines(e.target.value))} />
            </Field>
            <Field label="Required evidence fields">
              <Input value={(icp.requiredEvidenceFields ?? []).join(", ")} onChange={(e) => update("requiredEvidenceFields", fromLines(e.target.value))} />
            </Field>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Scoring weights{" "}
            <Badge tone={weightSum(icp.scoringWeights.fit) === 100 ? "success" : "warning"}>Fit total {weightSum(icp.scoringWeights.fit)}</Badge>{" "}
            <Badge tone={weightSum(icp.scoringWeights.risk) === 100 ? "success" : "warning"}>Risk total {weightSum(icp.scoringWeights.risk)}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <WeightEditor
            title={`Fit weights (${mode})`}
            weights={icp.scoringWeights.fit}
            onChange={(fit) => update("scoringWeights", { ...icp.scoringWeights, fit })}
          />
          <WeightEditor
            title="Risk weights"
            weights={icp.scoringWeights.risk}
            onChange={(risk) => update("scoringWeights", { ...icp.scoringWeights, risk })}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function WeightEditor({ title, weights, onChange }: { title: string; weights: Record<string, number>; onChange: (w: Record<string, number>) => void }) {
  return (
    <div>
      <h4 className="mb-2 text-sm font-semibold">{title}</h4>
      <div className="space-y-2">
        {Object.entries(weights).map(([key, value]) => (
          <div key={key} className="flex items-center gap-2">
            <span className="flex-1 text-xs text-muted-foreground">{key.replace(/_/g, " ")}</span>
            <Input
              type="number"
              className="h-8 w-20"
              value={value}
              onChange={(e) => onChange({ ...weights, [key]: Number(e.target.value) || 0 })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
