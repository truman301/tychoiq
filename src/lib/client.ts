"use client";

// Browser-side API client. Never imports server-only modules.
export async function api<T = unknown>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.ok === false) {
    const err = new Error(json?.error ?? `Request failed (${res.status})`);
    (err as Error & { details?: unknown }).details = json?.details;
    throw err;
  }
  return (json?.data ?? json) as T;
}

export const TIER_LABELS: Record<string, string> = {
  high: "High Priority",
  medium: "Medium",
  low: "Low",
  avoid: "Avoid",
};

export const LABEL_LABELS: Record<string, string> = {
  strong_fit: "Strong fit",
  possible_fit: "Possible fit",
  not_a_fit: "Not a fit",
  duplicate: "Duplicate",
  needs_research: "Needs research",
  risky: "Risky / do not target",
};

export const REASON_LABELS: Record<string, string> = {
  wrong_category: "Wrong category",
  too_small: "Too small",
  too_large: "Too large",
  wrong_geography: "Wrong geography",
  competitor: "Competitor",
  financially_distressed: "Financially distressed",
  no_staffing_need: "No staffing need",
  no_decision_maker: "No decision maker",
  poor_evidence: "Poor evidence",
  other: "Other",
};
