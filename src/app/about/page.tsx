import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";

export const dynamic = "force-static";

export default function AboutPage() {
  const steps = [
    { t: "1 · Define ICP", d: "Describe the target org, geography, categories, signals, and required evidence. Pick a template (incl. Quinable Mode)." },
    { t: "2 · Train first", d: "Seed positive/negative examples, run a discovery sample scan, and label candidates. The system updates centroids + weights." },
    { t: "3 · Lock the model", d: "Review the generated Model Understanding rubric and approve it. Large scans stay locked until training requirements + precision are met." },
    { t: "4 · Scan & score", d: "Connectors discover candidates → dedupe → enrich (permitted crawl) → extract evidence → deterministic fit/risk scoring." },
    { t: "5 · Review evidence", d: "Every score is backed by source URLs, snippets, and a transparent breakdown. No unsupported claims." },
    { t: "6 · Export (not spam)", d: "Export reviewed, evidence-backed candidates to CSV/Quinable/Clay/JSON. Human-review-before-outreach by design." },
  ];
  return (
    <div>
      <PageHeader title="How TychoIQ works" description="Train-first. Evidence-first. Precision over volume. Compliance-safe." />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {steps.map((s) => (
          <Card key={s.t}>
            <CardHeader>
              <CardTitle className="text-base">{s.t}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{s.d}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Hybrid scoring (auditable, not a black box)</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <ol className="list-decimal space-y-1 pl-5">
            <li>Rules-based component scores (category, geography, size, pain, triggers, evidence quality…).</li>
            <li>Embedding similarity to your labeled positive/negative examples (drives active learning).</li>
            <li>LLM structured extraction of evidence (mock heuristic offline; Claude/OpenAI when configured).</li>
            <li>Active-learning feedback from your labels updates centroids and metrics.</li>
          </ol>
          <p className="mt-2">LLMs extract structured fields and explain evidence; the numeric score stays deterministic and reproducible.</p>
        </CardContent>
      </Card>
    </div>
  );
}
