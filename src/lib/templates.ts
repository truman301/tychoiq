import type { IcpData, ProjectMode } from "@/lib/types";
import { GENERAL_WEIGHTS, QUINABLE_WEIGHTS } from "@/lib/scoring/weights";

export type ProjectTemplateDef = {
  key: string;
  name: string;
  description: string;
  mode: ProjectMode;
  industry: string;
  icp: IcpData;
};

const baseRequiredEvidence = ["category", "geography", "website"];

function generalIcp(overrides: Partial<IcpData>): IcpData {
  return {
    targetDescription: "",
    geography: { states: [], counties: [], cities: [], zips: [] },
    organizationTypesInclude: [],
    organizationTypesExclude: [],
    optionalCategories: [],
    sizeSignals: { minLocations: 1, preferredLocations: "2-50", minEmployees: 25 },
    buyerPersonaTitles: [],
    painSignals: [],
    triggerEvents: [],
    qualitySignals: [],
    riskSignals: [],
    sourcePreferences: ["brave_search", "google_places", "osm_overpass", "website_crawl", "csv_import"],
    requiredEvidenceFields: baseRequiredEvidence,
    scoringWeights: GENERAL_WEIGHTS,
    ...overrides,
  };
}

// Prebuilt Quinable ICP (spec 4.8).
export const QUINABLE_ICP: IcpData = {
  targetDescription:
    "Regional multi-location senior care / post-acute operators that have recurring staffing needs but are not financially distressed, with professional payment processes and expansion potential.",
  geography: { states: ["MI", "TX", "OH"], counties: [], cities: [], zips: [] },
  organizationTypesInclude: [
    "skilled nursing facility",
    "nursing home",
    "assisted living",
    "memory care",
    "rehab facility",
    "home health agency",
    "hospice agency",
    "senior living community",
  ],
  organizationTypesExclude: [
    "hospital",
    "individual physician practice",
    "travel nurse agency",
    "staffing agency",
  ],
  optionalCategories: ["post-acute care", "long-term care", "senior living operator"],
  sizeSignals: { minLocations: 1, preferredLocations: "2-50", minEmployees: 25 },
  buyerPersonaTitles: [
    "Administrator",
    "Executive Director",
    "Director of Nursing",
    "Staffing Coordinator",
    "VP of Operations",
    "Regional Director",
  ],
  painSignals: [
    "hiring CNAs, HHAs, LPNs, RNs",
    "weekend staffing",
    "agency staffing reduction",
    "call-off coverage",
  ],
  triggerEvents: ["new facility", "ownership change", "expansion", "leadership change"],
  qualitySignals: [
    "professional operator",
    "multi-site ownership",
    "good compliance record",
    "stable payment/customer profile",
  ],
  riskSignals: [
    "receivership",
    "bankruptcy",
    "payment complaints",
    "severe regulatory actions",
    "closed facility",
  ],
  sourcePreferences: [
    "cms_provider",
    "nppes",
    "google_places",
    "osm_overpass",
    "website_crawl",
    "brave_search",
    "csv_import",
  ],
  requiredEvidenceFields: ["facility_type", "geography", "website"],
  scoringWeights: QUINABLE_WEIGHTS,
};

export const PROJECT_TEMPLATES: ProjectTemplateDef[] = [
  {
    key: "general_b2b",
    name: "General B2B Prospecting",
    description: "Flexible template for any industry. Define your own ICP, sources, and weights.",
    mode: "general",
    industry: "General B2B",
    icp: generalIcp({
      targetDescription: "Companies that match a custom ideal customer profile.",
      organizationTypesInclude: ["company"],
      buyerPersonaTitles: ["VP", "Director", "Head of"],
    }),
  },
  {
    key: "pe_ma",
    name: "PE / M&A Target Sourcing",
    description: "Find acquisition / investment targets and roll-up candidates by thesis and geography.",
    mode: "pe_ma",
    industry: "Private Equity / M&A",
    icp: generalIcp({
      targetDescription:
        "Founder-owned, profitable, fragmented-market businesses fitting an acquisition thesis.",
      organizationTypesInclude: ["independent operator", "regional service business"],
      organizationTypesExclude: ["public company", "venture-backed startup"],
      sizeSignals: { minEmployees: 20, maxEmployees: 500, preferredLocations: "1-20" },
      buyerPersonaTitles: ["Owner", "Founder", "CEO", "President"],
      painSignals: ["succession", "owner retiring", "no clear successor"],
      triggerEvents: ["ownership change", "leadership change", "funding"],
      qualitySignals: ["recurring revenue", "established customer base", "stable margins"],
      riskSignals: ["bankruptcy", "litigation", "customer concentration"],
    }),
  },
  {
    key: "local_services",
    name: "Local Services Prospecting",
    description: "Map and prioritize local service businesses within a city/region radius.",
    mode: "local",
    industry: "Local Services",
    icp: generalIcp({
      targetDescription: "Established local service businesses within a target geography.",
      organizationTypesInclude: ["local service business"],
      sourcePreferences: ["google_places", "osm_overpass", "website_crawl", "csv_import"],
      buyerPersonaTitles: ["Owner", "General Manager"],
      painSignals: ["hiring", "expanding", "now booking"],
    }),
  },
  {
    key: "healthcare_facility",
    name: "Healthcare Facility Sourcing",
    description: "Discover healthcare facilities and operators using CMS/NPPES + local data.",
    mode: "healthcare",
    industry: "Healthcare",
    icp: generalIcp({
      targetDescription: "Healthcare facilities and operators matching a care-category profile.",
      organizationTypesInclude: ["skilled nursing facility", "assisted living", "home health agency"],
      organizationTypesExclude: ["hospital", "physician practice"],
      sourcePreferences: ["cms_provider", "nppes", "google_places", "website_crawl"],
      buyerPersonaTitles: ["Administrator", "Director of Nursing", "Executive Director"],
      painSignals: ["hiring clinical staff", "staffing", "agency reduction"],
      qualitySignals: ["multi-site", "compliance", "professional operator"],
      riskSignals: ["receivership", "regulatory penalties", "closure"],
      requiredEvidenceFields: ["facility_type", "geography", "website"],
    }),
  },
  {
    key: "quinable",
    name: "Quinable Mode (Healthcare Staffing)",
    description:
      "Prebuilt template for sourcing senior-care/post-acute operators that are good fits for Quinable's flexible staffing platform — scored on staffing need AND customer quality/payment risk.",
    mode: "quinable",
    industry: "Healthcare Staffing",
    icp: QUINABLE_ICP,
  },
  {
    key: "manufacturing",
    name: "Manufacturing / Distribution Prospecting",
    description: "Source manufacturers and distributors by category, size, and geography.",
    mode: "manufacturing",
    industry: "Manufacturing / Distribution",
    icp: generalIcp({
      targetDescription: "Small-to-mid manufacturers and distributors in target NAICS categories.",
      organizationTypesInclude: ["manufacturer", "distributor", "industrial services"],
      sizeSignals: { minEmployees: 50, maxEmployees: 2000, preferredLocations: "1-10" },
      buyerPersonaTitles: ["Plant Manager", "VP Operations", "Procurement Director"],
      painSignals: ["hiring", "capacity expansion", "new equipment"],
      sourcePreferences: ["brave_search", "website_crawl", "csv_import"],
    }),
  },
  {
    key: "b2b_saas",
    name: "B2B SaaS Account Sourcing",
    description: "Build target account lists for B2B SaaS GTM by firmographics and intent signals.",
    mode: "b2b_saas",
    industry: "B2B SaaS",
    icp: generalIcp({
      targetDescription: "Mid-market companies showing intent for a specific software category.",
      organizationTypesInclude: ["company"],
      sizeSignals: { minEmployees: 50, maxEmployees: 5000 },
      buyerPersonaTitles: ["VP Engineering", "CTO", "Head of RevOps", "Director of IT"],
      painSignals: ["hiring for relevant roles", "tech stack signals", "funding"],
      triggerEvents: ["funding", "leadership change", "product launch"],
      sourcePreferences: ["brave_search", "website_crawl", "csv_import"],
    }),
  },
];

export function getTemplate(key: string): ProjectTemplateDef | undefined {
  return PROJECT_TEMPLATES.find((t) => t.key === key);
}

// Default mock seed examples for Quinable (spec 4.3 step 1 — user must review).
export const QUINABLE_SEED_EXAMPLES = {
  positive: [
    { value: "Lakeside Post-Acute Center", note: "Multi-site SNF operator, hiring CNAs/LPNs" },
    { value: "Evergreen Senior Living Group", note: "Regional assisted living + memory care chain" },
    { value: "Riverbend Rehabilitation & Nursing", note: "Post-acute with weekend staffing needs" },
  ],
  negative: [
    { value: "Metro Regional Hospital", note: "Hospital — out of target category" },
    { value: "QuickStaff Healthcare Agency", note: "Staffing agency — competitor/conflict" },
    { value: "Dr. Smith Family Practice", note: "Individual physician practice — too small/wrong type" },
  ],
};
