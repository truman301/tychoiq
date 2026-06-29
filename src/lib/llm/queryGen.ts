import type { IcpData } from "@/lib/types";

export type SearchPlan = {
  region: string;
  queries: string[];
  exclusionTerms: string[];
  sourcePriority: string[];
  expectedCandidateTypes: string[];
};

// Deterministic, ICP-driven query generation (spec 4.5 / 7). Kept bounded so we
// never generate spammy/abusive query volume.
const MAX_QUERIES_PER_REGION = 12;

export function generateSearchPlans(icp: IcpData, regions: string[]): SearchPlan[] {
  const includeTypes = icp.organizationTypesInclude.length
    ? icp.organizationTypesInclude
    : ["organization"];
  const painTerms = icp.painSignals.slice(0, 4);

  return regions.map((region) => {
    const queries: string[] = [];
    for (const type of includeTypes) {
      queries.push(`"${type}" "${region}"`);
      queries.push(`"${type}" careers "${region}"`);
      if (painTerms[0]) queries.push(`"${type}" "${painTerms[0]}" "${region}"`);
    }
    // a couple of org-discovery queries that bias to permitted public pages
    queries.push(`${includeTypes[0]} operators "${region}" locations`);
    if (painTerms[1]) queries.push(`"${painTerms[1]}" "${includeTypes[0]}" "${region}"`);

    const dedupedQueries = [...new Set(queries)].slice(0, MAX_QUERIES_PER_REGION);

    const sourcePriority = icp.sourcePreferences.length
      ? icp.sourcePreferences
      : ["cms_provider", "nppes", "google_places", "osm_overpass", "brave_search", "website_crawl"];

    return {
      region,
      queries: dedupedQueries,
      exclusionTerms: icp.organizationTypesExclude,
      sourcePriority,
      expectedCandidateTypes: includeTypes,
    };
  });
}
