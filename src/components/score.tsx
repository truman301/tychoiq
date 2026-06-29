import { Badge } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export function TierBadge({ tier }: { tier?: string | null }) {
  const map: Record<string, { tone: "success" | "default" | "secondary" | "destructive"; label: string }> = {
    high: { tone: "success", label: "High Priority" },
    medium: { tone: "default", label: "Medium" },
    low: { tone: "secondary", label: "Low" },
    avoid: { tone: "destructive", label: "Avoid" },
  };
  const v = map[tier ?? "low"] ?? map.low;
  return <Badge tone={v.tone}>{v.label}</Badge>;
}

export function ScoreBar({
  label,
  value,
  max = 100,
  tone = "primary",
}: {
  label: string;
  value: number;
  max?: number;
  tone?: "primary" | "risk" | "muted";
}) {
  const pctValue = Math.max(0, Math.min(100, (value / max) * 100));
  const color = tone === "risk" ? "bg-destructive" : tone === "muted" ? "bg-muted-foreground" : "bg-primary";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{Math.round(value)}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${pctValue}%` }} />
      </div>
    </div>
  );
}

export function ScorePill({ score, label }: { score: number; label: string }) {
  const tone = score >= 80 ? "text-success" : score >= 60 ? "text-primary" : score >= 40 ? "text-amber-600" : "text-muted-foreground";
  return (
    <div className="flex flex-col items-center rounded-md border bg-card px-3 py-2">
      <span className={cn("text-2xl font-bold tabular-nums", tone)}>{Math.round(score)}</span>
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
    </div>
  );
}

export function ConfidenceDot({ confidence }: { confidence: number }) {
  const tone = confidence >= 0.7 ? "bg-success" : confidence >= 0.5 ? "bg-warning" : "bg-destructive";
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <span className={cn("h-2 w-2 rounded-full", tone)} />
      {Math.round(confidence * 100)}% conf.
    </span>
  );
}
