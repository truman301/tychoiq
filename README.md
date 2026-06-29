# TychoIQ

**An AI-trained, evidence-first prospect discovery & market-mapping platform.**

TychoIQ lets you define an Ideal Customer Profile (ICP), **train** the system with examples and labels, scan regions/data sources for matching organizations, enrich candidates with public evidence, **score fit *and* risk**, explain *why* each candidate is (or isn't) a fit, and export prioritized, evidence-backed prospect lists.

> **Deploying to a live site (tychoiq.com)?** See **[DEPLOY.md](DEPLOY.md)**.

It ships with a prebuilt **Quinable Mode** for sourcing senior-care / post-acute healthcare operators that are good fits for a flexible staffing platform — scored on staffing need **and** customer quality / payment risk.

> Built to the master spec in `claude_code_ai_prospecting_platform_prompt.md`. Independent product; no third‑party branding, code, or proprietary assets.

---

## Core philosophy (enforced in code)

1. **Train before scale** — large regional scans are *locked* until training requirements are met.
2. **Evidence-first** — every scored field is backed by a source URL, snippet, or dataset row. No unsupported claims.
3. **Precision over volume** — a Candidate Quality Gate prevents "High Priority" without ≥2 independent sources.
4. **Private, auditable projects** — every label, scoring-model snapshot, and source provenance is stored.
5. **Broad platform, vertical templates** — general ICPs + 7 templates including Quinable Mode.

---

## Quick start (no API keys required)

TychoIQ uses **PostgreSQL** and has **email+password accounts** (each user gets a private workspace).

```bash
# 1. Install dependencies
npm install

# 2. Start Postgres (Docker). Or point DATABASE_URL at any local/cloud Postgres.
docker compose up -d

# 3. Copy env + generate client + create tables + seed the demo project
cp .env.example .env
npm run setup        # = prisma generate && prisma db push && db:seed

# 4. Run the app
npm run dev          # http://localhost:3000  → sign in
```

The connectors + LLM run **fully in mock mode** (deterministic, offline) so the app works with **zero external API keys**.

The seed creates a login **`demo@tychoiq.com` / `demo12345`** with a **Quinable Demo** project: a sample scan (50 candidates incl. the 5 spec demo orgs), reviewed example labels, and a computed training model. New visitors can also **sign up** for their own isolated workspace.

> No Docker? Install Postgres locally (or use a free Neon database) and set `DATABASE_URL` in `.env`.

### Other scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm test` | Vitest unit tests (scoring, dedup, gate, normalization) |
| `npm run db:seed` | (Re)seed the demo project |
| `npm run db:reset` | Wipe + recreate + reseed the database |
| `npm run typecheck` | `tsc --noEmit` |

---

## What was built

### App (Next.js 15 App Router + TypeScript + Tailwind)

- **Dashboard** — projects, active scans, top candidates, stats.
- **New Project** — template picker (7 templates incl. Quinable Mode).
- **ICP Builder** — target/geography/categories/signals/size/personas/sources + **editable scoring weights**.
- **Training Center** — seed examples, discovery sample scan, **one-card-at-a-time label queue** (with reasons), **Model Understanding** rubric, **ICP lock / approve**, live precision/recall.
- **Scan Runs** — sample vs. large scans, gate enforcement + admin override, run history with source coverage.
- **Candidates Table** — sort/filter (tier/state/type/search), bulk label, CSV/manual import, export.
- **Candidate Detail** — 8 tabs: Overview (strategic summary), Evidence, Score breakdown, Locations/map, Contacts, Risk analysis, Outreach angle, Activity/history.
- **Map View** — dependency-free SVG market map with tier colors + density by state.
- **Exports & Integrations** — CSV, Quinable CSV, Clay-compatible CSV, JSON + CRM mapping notes.
- **Settings** — source connectors (enable/disable, mock/live), providers, compliance posture.

### Engine (in `src/lib`)

- **Hybrid scoring engine** (`scoring/`) — deterministic, auditable fit/risk components (0–100), priority, confidence, tiering, calibration, Candidate Quality Gate. Weights are configurable per project (general + Quinable schemes).
- **Training** (`training/`) — gate logic, validation metrics (precision/recall/F1), active-learning recompute (positive/negative embedding centroids), "Model Understanding" rubric, reproducible model snapshots.
- **Pipeline** (`pipeline/`) — normalize → **dedupe** (domain/NPI/CCN/place_id/phone/address + fuzzy name+geo via union-find) → enrich (permitted crawl) → extract → score → persist with full provenance.
- **Connectors** (`connectors/`) — modular plugins returning normalized `RawSourceRecord`s: web search, maps/places, CMS Provider Data, NPPES, website crawler (robots-aware), CSV import / manual add. All have **mock mode** + real-API `TODO`s.
- **LLM/embeddings** (`llm/`, `embeddings/`) — provider abstraction (mock / Anthropic / OpenAI via REST `fetch`) with deterministic heuristic + offline-embedding fallbacks so scans never hard-fail.
- **API** — full REST surface under `src/app/api/**` (projects, training, scans, candidates, exports, settings).

### Database (Prisma, 23 models)

User, Workspace, WorkspaceMember, Project, ProjectTemplate, ICPDefinition, SourceConnector, SourceRun, RawSourceRecord, Candidate, CandidateLocation, CandidateEvidence, CandidateContact, CandidateScore, CandidateLabel, ScanRun, ScanRunLog, TrainingExample, TrainingModelSnapshot, ExportJob, SavedList, SavedListCandidate, AuditLog.

---

## Environment variables

Copy `.env.example` → `.env`. Connectors/LLM are optional (mock mode), but **`DATABASE_URL` and `AUTH_SECRET` are required**:

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | local Postgres | PostgreSQL connection string (Docker compose / Neon / Railway). |
| `AUTH_SECRET` | dev placeholder | **Set a long random string in production** — signs session cookies. |
| `APP_URL` | `http://localhost:3000` | Public URL; HTTPS here makes session cookies `Secure`. |
| `DISABLE_SIGNUP` | `false` | `true` = invite-only (no public sign-up). |
| `MOCK_MODE` | `true` | When true, connectors + LLM use deterministic mock data. Set `false` to go live per provider. |
| `LLM_PROVIDER` | `mock` | `mock` \| `anthropic` \| `openai`. |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | – | Live Claude extraction/verification (`claude-opus-4-8` default). |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | – | Live OpenAI alternative. |
| `EMBEDDINGS_PROVIDER` | `mock` | `mock` (offline) \| `openai`. |
| `BRAVE_SEARCH_API_KEY`, `SERPAPI_API_KEY`, `BING_SEARCH_API_KEY`, `GOOGLE_CSE_*` | – | Search discovery connectors. |
| `GOOGLE_PLACES_API_KEY`, `MAPBOX_TOKEN`, `OVERPASS_API_URL` | – | Maps / local data. |
| `CMS_PROVIDER_DATA_BASE`, `NPPES_API_BASE` | public URLs | Government dataset endpoints (no key). |
| `CRAWLER_*` | sane defaults | User-agent, robots.txt respect, per-domain rate limits. |

---

## Architecture decisions & documented assumptions

The spec calls for Postgres+pgvector, Redis, BullMQ, and Docker. To honor *"prioritize a working MVP… favor simplicity"* and guarantee a zero-config local run, the MVP makes these **documented** substitutions, each behind a clean seam so the spec'd infra can drop in:

| Spec | Choice | Notes |
| --- | --- | --- |
| PostgreSQL + pgvector | **PostgreSQL** via Prisma | Embeddings stored as JSON; cosine similarity in TS. pgvector is an optional upgrade (see below). |
| Auth / multi-tenant | **Email+password accounts** | `node:crypto` scrypt hashing + HMAC-signed session cookies (no external auth dep). Each user gets a private workspace; every API route enforces workspace ownership (`src/lib/access.ts`). |
| Redis + BullMQ worker | **In-process `runScan()`** runner | Behind a single function so a BullMQ worker can replace it without touching the API. Add Redis + a worker service for nationwide background scans (see DEPLOY.md). |
| Mapbox/Leaflet | **Dependency-free SVG map** | Fully offline. Swap in Leaflet/OSM or Mapbox tiles in `MiniMap`. |
| shadcn/ui CLI | **Hand-rolled shadcn-style primitives** | Avoids interactive scaffolding; same look/feel. |
| Anthropic/OpenAI SDKs | **REST via `fetch`** | No SDK deps; provider abstraction + offline fallbacks. |

### Authentication & multi-tenancy

- Sign-up creates a `User` + a private `Workspace` (with default connectors). All data is scoped to the caller's workspace.
- Sessions are HMAC-signed cookies (`AUTH_SECRET`); `middleware.ts` gates pages, and every API route calls `requireSession()` / `assertProjectAccess()` so users can only see their own data (cross-tenant access returns `403`).
- Set `DISABLE_SIGNUP=true` to make the instance invite-only.

### Scaling up (pgvector + background worker)

1. **pgvector (optional):** add a `vector` column + index for `TrainingExample.embedding` / `Candidate.embedding` and replace the in-TS cosine search with a SQL `<=>` nearest-neighbour query.
2. **Background scanning:** add Redis + a BullMQ worker service that consumes a `scans` queue and calls `runScan(scanId)` (the single seam already used by the API). Required for long, nationwide scans. See **[DEPLOY.md](DEPLOY.md) §4**.

---

## Compliance & safety (implemented)

Public data only · no login/paywall/CAPTCHA bypass · respects `robots.txt` · per-domain rate limiting · stores source URLs + retrieval timestamps · **no patient/PHI data** (organization-level only) · **no automated outreach blasts** · human review required before outreach export · confidence + evidence shown for every claim · protected-class attributes excluded from scoring.

---

## Tests

```bash
npm test
```

28 tests across:
- **`scoring.test.ts`** — fit/risk scoring, exclusion (hospital/competitor), risk escalation, quality gate, breakdown integrity, bounds.
- **`dedup.test.ts`** — domain/NPI/CCN/place_id/phone/address grouping, fuzzy name+geo, false-merge avoidance.
- **`gate.test.ts`** — training gate requirements + override, validation metrics.
- **`normalize.test.ts`** — name/domain/phone normalization, record dedup keys, CSV import column mapping.

---

## Known limitations

- **Mock mode by default.** Real-world coverage requires enabling connectors + API keys and setting `MOCK_MODE=false`. Mock prospects are **synthetic, not real entities**.
- **Payment quality is inferred** from public proxies, not financial statements.
- **Embeddings** use a deterministic offline hash model unless an embeddings provider is configured.
- **In-process scans** run in the web process (awaited) — fine for mock/small scans; add a Redis + BullMQ worker for nationwide real scans (DEPLOY.md §4).
- **SVG map** is illustrative (equirectangular over the points' bounding box), not a real basemap.

---

## Next steps for real data connectors

Each connector has an `if (!ctx.mock && <key present>) { /* TODO(real-api) */ }` branch:

- **Search** (`sourceConnectors.ts → SearchConnector`): call Brave/SerpAPI/Bing/Google CSE with the ICP-driven query plan (`llm/queryGen.ts`); map snippets to `RawSourceRecord` (discovery only, not result-page scraping).
- **Places** (`PlacesConnector`): Google Places Text/Nearby Search or Overpass (`amenity=nursing_home`, `social_facility`) over a region grid.
- **CMS** (`CmsConnector`): query `data.cms.gov` provider/Care Compare/PBJ/ownership datasets; map CCN, beds, star rating, contract-staffing.
- **NPPES** (`NppesConnector`): `npiregistry.cms.hhs.gov/api` with `enumeration_type=NPI-2` + taxonomy + state filters.
- **Crawler** (`crawler.ts`): the robots-aware fetch path is implemented; add Playwright/Cheerio for richer rendering/parsing.
- **CRM/enrichment**: Apollo/PDL/Clearbit/HubSpot/Salesforce/Clay adapters — design the import/export mapping (export side + Clay CSV are done).

---

## Project map

```
prisma/schema.prisma          # 23 models (Postgres-portable)
prisma/seed.ts                # demo Quinable project end-to-end
src/lib/
  scoring/                    # deterministic fit/risk engine + weights
  training/                   # gate, metrics, rubric, recompute
  pipeline/                   # normalize, dedupe, scan orchestrator, outreach
  connectors/                 # mock universe + search/places/cms/nppes/crawler/csv
  llm/ embeddings/            # provider abstractions + offline fallbacks
  templates.ts icp.ts ...     # 7 templates incl. Quinable
src/app/                      # pages + full REST API under app/api/**
src/components/               # UI primitives, score widgets, map, nav
tests/                        # vitest: scoring, dedup, gate, normalize
```
