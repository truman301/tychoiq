import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { icpFromRow } from "@/lib/icp";
import { stringifyJson, parseJson } from "@/lib/json";
import type { Evidence, RawSourceRecord, Signal } from "@/lib/types";
import { DISCOVERY_CONNECTORS } from "@/lib/connectors/sourceConnectors";
import type { ConnectorContext } from "@/lib/connectors/types";
import { crawlWebsite } from "@/lib/connectors/crawler";
import { normalizeRecord, type NormalizedRecord } from "@/lib/pipeline/normalize";
import { dedupeRecords, type DedupRecord } from "@/lib/pipeline/dedup";
import { extractCandidateFields } from "@/lib/llm/extract";
import { scoreCandidate, type ScoringCandidate } from "@/lib/scoring";
import { buildOutreachAngle, recommendedTitles } from "@/lib/pipeline/outreach";
import { embed, candidateEmbeddingText, cosine } from "@/lib/embeddings";
import { extractDomain } from "@/lib/text";

// ----------------------------------------------------------------------------
// In-process scan job runner (spec 4.5). Abstracted behind runScan() so a real
// BullMQ/Redis worker can replace it without touching the API layer.
// Pipeline: discover -> normalize -> dedupe -> enrich(crawl) -> extract ->
// score -> persist with full source provenance + evidence.
// ----------------------------------------------------------------------------

async function log(scanRunId: string, stage: string, message: string, level = "info", meta?: unknown) {
  await prisma.scanRunLog.create({
    data: { scanRunId, stage, message, level, meta: meta ? stringifyJson(meta) : null },
  });
}

export async function runScan(scanRunId: string): Promise<void> {
  const scan = await prisma.scanRun.findUnique({
    include: { project: { include: { icp: true } } },
    where: { id: scanRunId },
  });
  if (!scan) return;

  try {
    await prisma.scanRun.update({ where: { id: scanRunId }, data: { status: "running", startedAt: new Date() } });
    await log(scanRunId, "init", `Starting ${scan.type} scan`);

    const project = scan.project;
    const icp = icpFromRow(project.icp, project.mode);
    const params = parseJson<{
      regions?: string[];
      maxCandidates?: number;
      connectors?: string[];
      importRecords?: RawSourceRecord[];
    }>(scan.params, {});

    // Determine enabled connectors for the workspace.
    const enabled = await prisma.sourceConnector.findMany({
      where: { workspaceId: project.workspaceId, enabled: true },
    });
    const enabledKeys = new Set(
      (params.connectors && params.connectors.length ? params.connectors : enabled.map((c) => c.key)),
    );
    const useMock = env.mockMode || enabled.every((c) => c.mock);

    const states = icp.geography.states ?? [];
    const maxCandidates = Math.min(
      params.maxCandidates ?? (scan.type === "sample" ? 50 : 200),
      scan.type === "sample" ? 100 : 500,
    );

    const ctx: ConnectorContext = {
      mode: project.mode,
      organizationTypes: icp.organizationTypesInclude,
      states,
      cities: icp.geography.cities ?? [],
      regionLabel: states.join(", ") || "all regions",
      maxRecords: maxCandidates,
      mock: useMock,
      importedRecords: params.importRecords,
    };

    // --- 1-3. Discover + persist raw records per source -----------------------
    const allNormalized: NormalizedRecord[] = [];
    const rawById = new Map<string, { recordId: string }>();
    let discovered = 0;

    for (const connector of DISCOVERY_CONNECTORS) {
      if (!enabledKeys.has(connector.key)) continue;
      const sourceRun = await prisma.sourceRun.create({
        data: { scanRunId, connectorKey: connector.key, status: "running" },
      });
      try {
        const records = await connector.discover(ctx);
        for (const raw of records) {
          const created = await prisma.rawSourceRecord.create({
            data: {
              sourceRunId: sourceRun.id,
              sourceType: raw.sourceType,
              sourceName: raw.sourceName,
              sourceUrl: raw.sourceUrl,
              retrievedAt: new Date(raw.retrievedAt),
              rawTitle: raw.rawTitle,
              rawText: raw.rawText,
              rawJson: raw.rawJson ? stringifyJson(raw.rawJson) : null,
              organizationName: raw.organizationName,
              website: raw.website,
              phone: raw.phone,
              email: raw.email,
              address: raw.address,
              city: raw.city,
              state: raw.state,
              postalCode: raw.postalCode,
              country: raw.country,
              latitude: raw.latitude,
              longitude: raw.longitude,
              externalIds: raw.externalIds ? stringifyJson(raw.externalIds) : null,
            },
          });
          const normalized = normalizeRecord(raw, created.id);
          allNormalized.push(normalized);
          rawById.set(created.id, { recordId: created.id });
          discovered += 1;
        }
        await prisma.sourceRun.update({
          where: { id: sourceRun.id },
          data: { status: "completed", recordCount: records.length, completedAt: new Date() },
        });
        await log(scanRunId, "discover", `${connector.name}: ${records.length} records`);
      } catch (err) {
        await prisma.sourceRun.update({
          where: { id: sourceRun.id },
          data: { status: "failed", error: String(err), completedAt: new Date() },
        });
        await log(scanRunId, "discover", `${connector.name} failed: ${err}`, "warn");
      }
    }

    // --- 4-5. Normalize + deduplicate ----------------------------------------
    const dedupInput: DedupRecord[] = allNormalized.map((r) => ({
      id: r.id,
      name: r.organizationName ?? r.rawTitle ?? "",
      normalizedName: r.normalizedName,
      domain: r.domain,
      phoneKey: r.phoneKey,
      addressKey: r.addressKey,
      npi: r.npi,
      ccn: r.ccn,
      placeId: r.placeId,
      latitude: r.latitude ?? null,
      longitude: r.longitude ?? null,
      city: r.city ?? null,
      state: r.state ?? null,
    }));
    const clusters = dedupeRecords(dedupInput);
    await log(scanRunId, "dedupe", `${discovered} records -> ${clusters.length} unique entities`);

    const byId = new Map(allNormalized.map((r) => [r.id, r]));

    // Latest approved/most-recent model snapshot for similarity nudges.
    const snapshot = await prisma.trainingModelSnapshot.findFirst({
      where: { projectId: project.id },
      orderBy: { createdAt: "desc" },
    });
    const posCentroid = parseJson<number[] | null>(snapshot?.positiveCentroid ?? null, null);
    const negCentroid = parseJson<number[] | null>(snapshot?.negativeCentroid ?? null, null);

    // --- 6-11. Enrich, extract, score, persist each candidate -----------------
    let scored = 0;
    let queuedForReview = 0;
    const limited = clusters.slice(0, maxCandidates);

    for (const cluster of limited) {
      const members = cluster.map((c) => byId.get(c.id)!).filter(Boolean);
      const merged = mergeCluster(members);

      // enrichment: crawl website (mock-backed)
      let crawlText = "";
      let crawlEvidence: Evidence | null = null;
      let hints = merged.hints;
      if (merged.website) {
        const crawl = await crawlWebsite(merged.website, useMock);
        crawlText = crawl.text;
        hints = { ...hints, ...(crawl.hints ?? {}) };
        crawlEvidence = {
          sourceName: "Website crawl",
          sourceType: "website",
          url: crawl.sourceUrl,
          retrievedAt: new Date().toISOString(),
          snippet: crawl.text.slice(0, 160),
          confidence: "medium",
          field: "website",
        };
      }

      const combinedText = [merged.rawText, crawlText].filter(Boolean).join("\n\n");
      const extraction = await extractCandidateFields(combinedText, {
        sourceName: merged.primarySourceName,
        sourceType: "website",
        url: merged.website,
        retrievedAt: new Date().toISOString(),
      });

      const organizationType = extraction.organizationType ?? hints.organizationType ?? guessType(merged, extraction.services);
      const multiSite = extraction.qualitySignals.some((s) => s.type === "multi_site") || (hints.facilityCount ?? 0) > 1;

      const scoringCandidate: ScoringCandidate = {
        name: merged.name,
        organizationType,
        website: merged.website,
        domain: merged.domain,
        description: extraction.description,
        services: extraction.services,
        locations: merged.locations,
        state: merged.state,
        facilityCountEstimate: hints.facilityCount ?? (multiSite ? 3 : merged.locations.length || null),
        employeeCountEstimate: null,
        bedCount: merged.bedCount ?? hints.bedCount ?? null,
        starRating: merged.starRating ?? hints.starRating ?? null,
        contacts: extraction.decisionMakerTitles.map((t) => ({ title: t, source: "website", confidence: "low" as const })),
        painSignals: extraction.painSignals,
        qualitySignals: extraction.qualitySignals,
        riskSignals: extraction.riskSignals,
        triggerEvents: extraction.triggerEvents,
        competitorSignals: extraction.competitorSignals,
        hospitalSignals: extraction.hospitalSignals,
      };

      const distinctSourceCount = new Set(members.map((m) => m.sourceName)).size + (crawlEvidence ? 1 : 0);
      const hasAuthoritative = members.some(
        (m) => m.sourceType === "gov_dataset",
      );

      const score = scoreCandidate(scoringCandidate, {
        mode: project.mode,
        icp,
        distinctSourceCount,
        hasAuthoritativeDatasetEvidence: hasAuthoritative,
      });

      // embedding + similarity nudge (hybrid scoring component #2 -> active learning)
      const embedding = await embed(
        candidateEmbeddingText({
          name: merged.name,
          organizationType,
          description: extraction.description,
          services: extraction.services,
        }),
      );
      if (posCentroid && negCentroid) {
        const simPos = cosine(embedding, posCentroid);
        const simNeg = cosine(embedding, negCentroid);
        if (simPos - simNeg > 0.08) score.topReasonsToTarget.push("Similar to your labeled positive examples");
        else if (simNeg - simPos > 0.08) score.topReasonsToAvoid.push("Similar to your labeled negative examples");
      }

      const outreachAngle = buildOutreachAngle({
        mode: project.mode,
        name: merged.name,
        organizationType,
        painSignals: extraction.painSignals,
        qualitySignals: extraction.qualitySignals,
        multiSite,
      });
      const titles = recommendedTitles(project.mode, icp);

      const needsReview = score.priorityTier !== "high" || score.confidence < 0.7 || score.missingInfo.length > 0;

      // Build evidence list: one per contributing source + per-signal evidence.
      const evidence: Evidence[] = members.map((m) => ({
        sourceName: m.sourceName,
        sourceType: m.sourceType,
        url: m.sourceUrl,
        retrievedAt: new Date(m.retrievedAt).toISOString(),
        snippet: (m.rawText ?? m.rawTitle ?? "").slice(0, 160),
        confidence: m.sourceType === "gov_dataset" ? "high" : "medium",
        field: "source",
      }));
      if (crawlEvidence) evidence.push(crawlEvidence);
      for (const sig of [...extraction.painSignals, ...extraction.qualitySignals, ...extraction.riskSignals, ...extraction.triggerEvents]) {
        if (sig.evidence) evidence.push({ ...sig.evidence, field: sig.type });
      }

      const candidate = await prisma.candidate.create({
        data: {
          projectId: project.id,
          scanRunId,
          name: merged.name,
          normalizedName: merged.normalizedName,
          website: merged.website,
          domain: merged.domain,
          organizationType,
          description: extraction.description,
          facilityCountEstimate: scoringCandidate.facilityCountEstimate ?? undefined,
          parentCompany: hints.parentCompany,
          phoneKey: merged.phoneKey,
          addressKey: merged.addressKey,
          npi: merged.npi,
          ccn: merged.ccn,
          placeId: merged.placeId,
          bedCount: scoringCandidate.bedCount ?? undefined,
          starRating: scoringCandidate.starRating ?? undefined,
          services: stringifyJson(extraction.services),
          painSignals: stringifyJson(extraction.painSignals),
          qualitySignals: stringifyJson(extraction.qualitySignals),
          riskSignals: stringifyJson(extraction.riskSignals),
          triggerEvents: stringifyJson(extraction.triggerEvents),
          recommendedTitles: stringifyJson(titles),
          outreachAngle,
          embedding: stringifyJson(embedding),
          status: needsReview ? "needs_review" : "new",
          priorityTier: score.priorityTier,
          lastVerifiedAt: new Date(),
          locations: {
            create: merged.locations.map((l) => ({
              address: l.address,
              city: l.city,
              state: l.state,
              postalCode: l.postalCode,
              country: l.country ?? "US",
              latitude: l.latitude,
              longitude: l.longitude,
              isHeadquarters: l.isHeadquarters ?? false,
            })),
          },
          evidence: {
            create: evidence.map((e) => ({
              field: e.field ?? "general",
              sourceName: e.sourceName,
              sourceType: e.sourceType,
              url: e.url,
              retrievedAt: new Date(e.retrievedAt),
              snippet: e.snippet,
              confidence: e.confidence,
            })),
          },
          contacts: {
            create: extraction.decisionMakerTitles.slice(0, 6).map((t) => ({
              title: t,
              source: "website",
              confidence: "low",
            })),
          },
          scores: {
            create: {
              fitScore: score.fitScore,
              riskScore: score.riskScore,
              priorityScore: score.priorityScore,
              confidence: score.confidence,
              scoreBreakdown: stringifyJson(score.scoreBreakdown),
              topReasonsToTarget: stringifyJson(score.topReasonsToTarget),
              topReasonsToAvoid: stringifyJson(score.topReasonsToAvoid),
              missingInfo: stringifyJson(score.missingInfo),
              recommendedNextAction: score.recommendedNextAction,
              modelSnapshotId: snapshot?.id,
            },
          },
        },
      });

      // link raw records to the candidate (provenance)
      await prisma.rawSourceRecord.updateMany({
        where: { id: { in: members.map((m) => m.id) } },
        data: { candidateId: candidate.id },
      });

      scored += 1;
      if (needsReview) queuedForReview += 1;
    }

    const counts = { discovered, deduped: clusters.length, enriched: scored, scored, queuedForReview, saved: scored };
    await prisma.scanRun.update({
      where: { id: scanRunId },
      data: {
        status: "completed",
        completedAt: new Date(),
        counts: stringifyJson(counts),
        connectorsUsed: stringifyJson([...enabledKeys]),
        regionSummary: ctx.regionLabel,
      },
    });
    await log(scanRunId, "done", `Scan complete: ${scored} candidates saved, ${queuedForReview} queued for review`);
  } catch (err) {
    await prisma.scanRun.update({
      where: { id: scanRunId },
      data: { status: "failed", error: String(err), completedAt: new Date() },
    });
    await log(scanRunId, "error", `Scan failed: ${err}`, "error");
  }
}

// --- helpers ----------------------------------------------------------------
type MergedEntity = {
  name: string;
  normalizedName: string;
  website?: string;
  domain: string | null;
  phoneKey: string | null;
  addressKey: string | null;
  npi: string | null;
  ccn: string | null;
  placeId: string | null;
  state?: string;
  bedCount?: number | null;
  starRating?: number | null;
  rawText: string;
  primarySourceName: string;
  hints: { organizationType?: string; bedCount?: number; starRating?: number; facilityCount?: number; parentCompany?: string };
  locations: {
    address?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
    isHeadquarters?: boolean;
  }[];
};

function mergeCluster(members: NormalizedRecord[]): MergedEntity {
  // canonical: prefer a member with a website, else the most complete one.
  const withSite = members.find((m) => m.website);
  const canonical = withSite ?? members[0];
  const pickFirst = <T>(get: (m: NormalizedRecord) => T | null | undefined): T | null =>
    members.map(get).find((v) => v != null && v !== "") ?? null;

  // bedCount / starRating come from CMS rawJson
  let bedCount: number | null = null;
  let starRating: number | null = null;
  for (const m of members) {
    const j = (m.rawJson ?? {}) as Record<string, unknown>;
    if (typeof j.certified_beds === "number") bedCount = j.certified_beds as number;
    if (typeof j.overall_rating === "number") starRating = j.overall_rating as number;
  }

  const locations = members
    .filter((m) => m.address || m.city || (m.latitude != null && m.longitude != null))
    .map((m, i) => ({
      address: m.address,
      city: m.city,
      state: m.state,
      postalCode: m.postalCode,
      country: m.country ?? "US",
      latitude: m.latitude,
      longitude: m.longitude,
      isHeadquarters: i === 0,
    }));
  // dedupe identical locations by addressKey
  const seenLoc = new Set<string>();
  const uniqueLocations = locations.filter((l) => {
    const key = `${l.address}|${l.city}|${l.state}`.toLowerCase();
    if (seenLoc.has(key)) return false;
    seenLoc.add(key);
    return true;
  });

  return {
    name: pickFirst((m) => m.organizationName) ?? canonical.organizationName ?? canonical.rawTitle ?? "Unknown",
    normalizedName: canonical.normalizedName,
    website: pickFirst((m) => m.website) ?? undefined,
    domain: pickFirst((m) => m.domain),
    phoneKey: pickFirst((m) => m.phoneKey),
    addressKey: pickFirst((m) => m.addressKey),
    npi: pickFirst((m) => m.npi),
    ccn: pickFirst((m) => m.ccn),
    placeId: pickFirst((m) => m.placeId),
    state: pickFirst((m) => m.state) ?? undefined,
    bedCount,
    starRating,
    rawText: members.map((m) => m.rawText).filter(Boolean).join("\n\n"),
    primarySourceName: canonical.sourceName,
    hints: {},
    locations: uniqueLocations,
  };
}

function guessType(merged: MergedEntity, services: string[]): string | undefined {
  const hay = `${merged.name} ${services.join(" ")}`.toLowerCase();
  const types = ["skilled nursing", "assisted living", "memory care", "home health", "hospice", "rehab", "nursing home"];
  return types.find((t) => hay.includes(t));
}

// Imported by RawSourceRecord typing only (keeps tree-shaking honest).
export type { RawSourceRecord };
