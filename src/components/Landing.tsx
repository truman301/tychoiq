import Link from "next/link";
import { Logo, LogoTile } from "@/components/Logo";
import { Button } from "@/components/ui/primitives";
import {
  Target,
  GraduationCap,
  ShieldCheck,
  Map as MapIcon,
  FileSearch,
  Layers,
  ArrowRight,
  Check,
} from "lucide-react";

const STEPS = [
  { n: "01", title: "Define your ICP", body: "Describe the org, geography, categories, and the signals that matter. Start from a template or build your own." },
  { n: "02", title: "Train the model", body: "Seed positive and negative examples, run a discovery sample, and label candidates. The model learns from you." },
  { n: "03", title: "Lock the rubric", body: "Review the generated model-understanding rubric and approve it. Large scans stay locked until training holds." },
  { n: "04", title: "Scan and score", body: "Connectors discover, dedupe, and enrich candidates, then deterministic fit and risk scoring ranks them." },
  { n: "05", title: "Review the evidence", body: "Every score is backed by source URLs, snippets, and a transparent breakdown. No unsupported claims." },
  { n: "06", title: "Export, not spam", body: "Send reviewed, evidence-backed candidates to CSV, Clay, or your CRM. Human review before any outreach." },
];

const FEATURES = [
  { icon: GraduationCap, title: "Train before you scale", body: "Large regional scans stay locked until the model meets your labeling and precision thresholds." },
  { icon: FileSearch, title: "Evidence-first scoring", body: "Every field is backed by a source URL, snippet, or dataset row — auditable, never a black box." },
  { icon: ShieldCheck, title: "Risk, not just fit", body: "Score who's worth selling to: payment quality, distress, and compliance signals, alongside fit." },
  { icon: MapIcon, title: "Region scanner", body: "Scan by state, county, city, or radius and see local market density at a glance." },
  { icon: Layers, title: "Vertical templates", body: "Seven prebuilt templates, including Quinable Mode for senior-care and post-acute staffing." },
  { icon: Target, title: "Precision over volume", body: "A quality gate blocks 'high priority' without independent corroborating evidence." },
];

export function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* top nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 md:px-8">
        <Logo tone="light" subtitle={null} />
        <nav className="flex items-center gap-2 sm:gap-4">
          <Link href="/about" className="hidden text-sm font-medium text-muted-foreground hover:text-foreground sm:block">
            How it works
          </Link>
          <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            Sign in
          </Link>
          <Link href="/signup">
            <Button size="sm">Get started</Button>
          </Link>
        </nav>
      </header>

      {/* hero */}
      <section className="mx-auto max-w-6xl px-5 pt-8 md:px-8 md:pt-12">
        <div className="relative overflow-hidden rounded-3xl bg-sidebar px-6 py-16 text-center md:px-12 md:py-24">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.18]"
            style={{
              backgroundImage: "radial-gradient(#ffffff 1px, transparent 1px)",
              backgroundSize: "26px 26px",
            }}
          />
          <div
            className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[40rem] -translate-x-1/2 rounded-full opacity-40 blur-3xl"
            style={{ background: "radial-gradient(closest-side, #6d5cf0, transparent)" }}
          />
          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full border border-sidebar-border bg-sidebar-accent px-3 py-1 text-xs font-medium text-sidebar-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-star" /> Train-first prospect discovery
            </span>
            <h1 className="mx-auto mt-6 max-w-3xl font-display text-4xl font-bold leading-[1.05] tracking-tight text-white md:text-6xl">
              Find the accounts <span className="text-[hsl(250_85%_78%)]">databases miss.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base text-sidebar-foreground md:text-lg">
              Tycho IQ is an AI-trained, evidence-first discovery engine. Train it on your
              ideal customer, scan a region, and score every prospect on fit and risk —
              with a source behind every number.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/signup">
                <Button size="lg" className="w-full sm:w-auto">
                  Start a project <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/about">
                <Button size="lg" variant="outline" className="w-full border-sidebar-border bg-transparent text-white hover:bg-sidebar-accent hover:text-white sm:w-auto">
                  See how it works
                </Button>
              </Link>
            </div>
            <p className="mt-5 text-xs text-sidebar-muted">No credit card · Your own private workspace · Sample data included</p>
          </div>
        </div>
      </section>

      {/* features */}
      <section className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">A discovery engine, not another contact list</h2>
          <p className="mt-3 text-muted-foreground">
            Traditional databases sell you the same accounts everyone else already has. Tycho IQ
            finds the ones they miss — and proves why each one fits.
          </p>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <f.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-display text-lg font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* how it works */}
      <section className="border-y bg-muted/40">
        <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">From ICP to evidence-backed list in six steps</h2>
            <p className="mt-3 text-muted-foreground">Train-first by design. The system won't run a large scan until it has learned what good looks like.</p>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-2xl border bg-card p-6">
                <div className="font-display text-sm font-semibold text-primary">{s.n}</div>
                <h3 className="mt-2 font-display text-lg font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* compliance / trust */}
      <section className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">Built to be auditable and safe</h2>
            <p className="mt-3 text-muted-foreground">
              Scoring stays deterministic and reproducible. LLMs only extract and explain evidence —
              they never invent the number. Public data only, with provenance stored on every record.
            </p>
            <div className="mt-6 space-y-2.5">
              {[
                "Public data only, or your own authorized uploads",
                "Respects robots.txt — no login, paywall, or CAPTCHA bypass",
                "Source URLs and timestamps stored on every claim",
                "Human review required before any outreach export",
                "Protected-class attributes excluded from scoring",
              ].map((t) => (
                <div key={t} className="flex items-start gap-2.5 text-sm">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  <span>{t}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-3xl border bg-gradient-to-br from-accent to-card p-8">
            <div className="flex items-center gap-3">
              <LogoTile className="h-10 w-10" />
              <div>
                <div className="font-display font-semibold">Quinable Mode</div>
                <div className="text-xs text-muted-foreground">Prebuilt healthcare-staffing template</div>
              </div>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Source senior-care and post-acute operators that fit a flexible staffing platform —
              scored on staffing need <em>and</em> customer quality and payment risk, with CMS/NPI
              fields, bed counts, and a suggested outreach angle on every candidate.
            </p>
            <Link href="/signup" className="mt-5 inline-flex">
              <Button>Try Quinable Mode <ArrowRight className="h-4 w-4" /></Button>
            </Link>
          </div>
        </div>
      </section>

      {/* final CTA */}
      <section className="mx-auto max-w-6xl px-5 pb-20 md:px-8">
        <div className="rounded-3xl border bg-card px-6 py-12 text-center shadow-sm md:py-16">
          <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">Start finding better prospects today</h2>
          <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
            Spin up a private workspace, try Quinable Mode or a custom ICP, and see evidence-backed
            scoring on sample data in minutes.
          </p>
          <Link href="/signup" className="mt-7 inline-flex">
            <Button size="lg">Create your workspace <ArrowRight className="h-4 w-4" /></Button>
          </Link>
        </div>
      </section>

      {/* footer */}
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 md:flex-row md:px-8">
          <Logo tone="light" subtitle={null} />
          <div className="flex items-center gap-5 text-sm text-muted-foreground">
            <Link href="/about" className="hover:text-foreground">How it works</Link>
            <Link href="/login" className="hover:text-foreground">Sign in</Link>
            <Link href="/signup" className="hover:text-foreground">Get started</Link>
          </div>
          <div className="text-xs text-muted-foreground">© {new Date().getFullYear()} Tycho IQ</div>
        </div>
      </footer>
    </div>
  );
}
