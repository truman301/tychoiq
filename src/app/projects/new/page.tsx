"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, Button, Input, Label, Badge, Spinner } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

type Template = {
  key: string;
  name: string;
  description: string;
  mode: string;
  industry: string;
  organizationTypes: string[];
};

export default function NewProjectPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selected, setSelected] = useState<string>("quinable");
  const [name, setName] = useState("");
  const [seedExamples, setSeedExamples] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Template[]>("/api/templates").then(setTemplates).catch((e) => setError(e.message));
  }, []);

  const selectedTpl = templates.find((t) => t.key === selected);
  const isHealthcare = selectedTpl?.mode === "quinable" || selectedTpl?.mode === "healthcare";

  async function create() {
    setError(null);
    if (!name.trim()) {
      setError("Please enter a project name.");
      return;
    }
    setLoading(true);
    try {
      const project = await api<{ id: string }>("/api/projects", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), templateKey: selected, seedQuinableExamples: isHealthcare && seedExamples }),
      });
      router.push(`/projects/${project.id}/icp`);
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader title="New project" description="Pick a template to start. You'll refine the ICP and train before any large scan." />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => (
          <button
            key={t.key}
            onClick={() => setSelected(t.key)}
            className={cn(
              "relative rounded-lg border bg-card p-4 text-left transition-colors hover:border-primary/60",
              selected === t.key && "border-primary ring-2 ring-primary/30",
            )}
          >
            {selected === t.key && (
              <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="h-3 w-3" />
              </span>
            )}
            <div className="flex items-center gap-2">
              <span className="font-semibold">{t.name}</span>
              {t.mode === "quinable" && <Badge tone="success">Prebuilt</Badge>}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>
            <div className="mt-3 flex flex-wrap gap-1">
              {t.organizationTypes.slice(0, 3).map((o) => (
                <Badge key={o} tone="secondary" className="text-[10px]">
                  {o}
                </Badge>
              ))}
            </div>
          </button>
        ))}
      </div>

      <Card className="mt-6 max-w-2xl">
        <CardContent className="space-y-4 p-5">
          <div className="space-y-1.5">
            <Label htmlFor="name">Project name</Label>
            <Input
              id="name"
              placeholder={isHealthcare ? "e.g. Michigan SNF Sourcing Q3" : "e.g. Midwest Manufacturing Targets"}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {isHealthcare && (
            <label className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-sm">
              <input type="checkbox" className="mt-0.5" checked={seedExamples} onChange={(e) => setSeedExamples(e.target.checked)} />
              <span>
                Seed default healthcare example labels (positive + negative). <strong>You must review them</strong> in the Training Center before they count.
              </span>
            </label>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex items-center gap-3">
            <Button onClick={create} disabled={loading}>
              {loading ? <Spinner /> : null} Create project
            </Button>
            <span className="text-xs text-muted-foreground">
              {selectedTpl ? `Template: ${selectedTpl.name}` : "Select a template"}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
