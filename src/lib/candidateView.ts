import type { Candidate, CandidateScore, CandidateEvidence, CandidateLocation, CandidateContact, CandidateLabel } from "@prisma/client";
import { parseJson, parseStringArray } from "@/lib/json";
import type { Signal } from "@/lib/types";

export type CandidateWithRelations = Candidate & {
  scores?: CandidateScore[];
  evidence?: CandidateEvidence[];
  locations?: CandidateLocation[];
  contacts?: CandidateContact[];
  labels?: CandidateLabel[];
};

export function serializeCandidate(c: CandidateWithRelations) {
  const score = (c.scores ?? [])[0];
  return {
    id: c.id,
    projectId: c.projectId,
    scanRunId: c.scanRunId,
    name: c.name,
    website: c.website,
    domain: c.domain,
    organizationType: c.organizationType,
    description: c.description,
    parentCompany: c.parentCompany,
    facilityCountEstimate: c.facilityCountEstimate,
    employeeCountEstimate: c.employeeCountEstimate,
    bedCount: c.bedCount,
    starRating: c.starRating,
    npi: c.npi,
    ccn: c.ccn,
    placeId: c.placeId,
    status: c.status,
    priorityTier: c.priorityTier,
    reviewed: c.reviewed,
    contacted: c.contacted,
    notes: c.notes,
    outreachAngle: c.outreachAngle,
    recommendedTitles: parseStringArray(c.recommendedTitles),
    services: parseStringArray(c.services),
    painSignals: parseJson<Signal[]>(c.painSignals, []),
    qualitySignals: parseJson<Signal[]>(c.qualitySignals, []),
    riskSignals: parseJson<Signal[]>(c.riskSignals, []),
    triggerEvents: parseJson<Signal[]>(c.triggerEvents, []),
    lastVerifiedAt: c.lastVerifiedAt,
    score: score
      ? {
          fitScore: score.fitScore,
          riskScore: score.riskScore,
          priorityScore: score.priorityScore,
          confidence: score.confidence,
          scoreBreakdown: parseJson<Record<string, number>>(score.scoreBreakdown, {}),
          topReasonsToTarget: parseStringArray(score.topReasonsToTarget),
          topReasonsToAvoid: parseStringArray(score.topReasonsToAvoid),
          missingInfo: parseStringArray(score.missingInfo),
          recommendedNextAction: score.recommendedNextAction,
        }
      : null,
    locations: (c.locations ?? []).map((l) => ({
      address: l.address,
      city: l.city,
      state: l.state,
      postalCode: l.postalCode,
      latitude: l.latitude,
      longitude: l.longitude,
      isHeadquarters: l.isHeadquarters,
    })),
    contacts: (c.contacts ?? []).map((x) => ({ name: x.name, title: x.title, email: x.email, phone: x.phone, confidence: x.confidence })),
    evidence: (c.evidence ?? []).map((e) => ({
      field: e.field,
      sourceName: e.sourceName,
      sourceType: e.sourceType,
      url: e.url,
      snippet: e.snippet,
      confidence: e.confidence,
      retrievedAt: e.retrievedAt,
    })),
    labels: (c.labels ?? []).map((l) => ({ label: l.label, reasons: parseStringArray(l.reasons), note: l.note, createdAt: l.createdAt })),
  };
}

export type SerializedCandidate = ReturnType<typeof serializeCandidate>;
