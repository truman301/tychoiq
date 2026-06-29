import type { ConnectorContext } from "@/lib/connectors/types";
import { extractDomain, slugify } from "@/lib/text";

// Deterministic mock "world" of organizations used by every connector in mock
// mode. The same org is exposed by multiple connectors (with slightly different
// formatting / partial fields) so the dedup + multi-source-evidence paths are
// genuinely exercised. No real entities are represented; this is synthetic data.

export type MockOrg = {
  id: string;
  name: string;
  type: string;
  website?: string;
  phone?: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  lat: number;
  lng: number;
  npi?: string;
  ccn?: string;
  placeId?: string;
  bedCount?: number;
  starRating?: number;
  facilityCount?: number;
  parentCompany?: string;
  marketingText: string;
  careersText?: string;
  newsText?: string;
  isHospital?: boolean;
  isCompetitor?: boolean;
};

const STATE_CENTERS: Record<string, [number, number]> = {
  MI: [42.95, -85.5],
  TX: [32.78, -96.8],
  OH: [40.0, -82.99],
  CA: [36.78, -119.42],
  FL: [27.66, -81.52],
  NY: [42.95, -75.52],
  IL: [40.0, -89.0],
  PA: [40.59, -77.2],
};

function jitter(seed: number, base: number, spread = 0.6): number {
  const r = ((Math.sin(seed * 12.9898) * 43758.5453) % 1 + 1) % 1;
  return base + (r - 0.5) * spread;
}

// Named healthcare demo orgs (spec section 11 + extras) — rich text drives the
// signal extraction so the demo is meaningful.
const NAMED_HEALTHCARE: Omit<MockOrg, "lat" | "lng">[] = [
  {
    id: "lakeside-post-acute",
    name: "Lakeside Post-Acute Center",
    type: "skilled nursing facility",
    website: "https://lakesidepostacute.example.com",
    phone: "(616) 555-0142",
    address: "1200 Lakeshore Dr",
    city: "Grand Rapids",
    state: "MI",
    postalCode: "49503",
    ccn: "235123",
    npi: "1093711111",
    placeId: "mock_place_lakeside",
    bedCount: 120,
    starRating: 4,
    facilityCount: 6,
    parentCompany: "Lakeside Care Group",
    marketingText:
      "Lakeside Post-Acute Center is part of Lakeside Care Group, a family of communities operating skilled nursing and post-acute rehabilitation across Michigan. We are Medicare certified and CHAP accredited with a strong compliance program and infection control standards.",
    careersText:
      "Careers at Lakeside: We are now hiring CNAs, LPNs and RNs across our locations. Help us provide weekend coverage and reduce agency staffing. Apply now to join our team.",
    newsText:
      "Lakeside Care Group announced the opening of a newly opened rehabilitation wing this quarter, expanding capacity in West Michigan.",
  },
  {
    id: "sunrise-memory-care",
    name: "Sunrise Memory Care of North County",
    type: "memory care",
    website: "https://sunrisememorync.example.com",
    phone: "(214) 555-0188",
    address: "455 Prairie View Rd",
    city: "Plano",
    state: "TX",
    postalCode: "75024",
    ccn: undefined,
    npi: "1093722222",
    placeId: "mock_place_sunrise",
    bedCount: 48,
    starRating: 3,
    facilityCount: 1,
    marketingText:
      "Sunrise Memory Care of North County is a dedicated memory care community providing assisted living and specialized dementia care.",
    careersText:
      "Now hiring caregivers and HHAs. We need help with call-off coverage and open shifts on weekends. Join our team today.",
  },
  {
    id: "metro-regional-hospital",
    name: "Metro Regional Hospital",
    type: "hospital",
    website: "https://metroregional.example.com",
    phone: "(313) 555-0110",
    address: "900 Medical Center Blvd",
    city: "Detroit",
    state: "MI",
    postalCode: "48201",
    npi: "1093733333",
    placeId: "mock_place_metro",
    bedCount: 410,
    starRating: 3,
    isHospital: true,
    marketingText:
      "Metro Regional Hospital is a full-service acute care hospital with a Level I trauma center and 24/7 emergency department serving metro Detroit.",
    careersText: "Hospital careers: physicians, surgical staff, and emergency department nurses.",
  },
  {
    id: "quickstaff-agency",
    name: "QuickStaff Healthcare Agency",
    type: "staffing agency",
    website: "https://quickstaffhc.example.com",
    phone: "(469) 555-0133",
    address: "77 Staffing Way",
    city: "Dallas",
    state: "TX",
    postalCode: "75201",
    placeId: "mock_place_quickstaff",
    isCompetitor: true,
    marketingText:
      "QuickStaff Healthcare Agency is a nurse staffing agency providing travel nurse and per diem agency staffing solutions. We staff facilities nationwide.",
    careersText: "Travel nursing assignments available. Per diem agency shifts open now.",
  },
  {
    id: "troubled-pines",
    name: "Troubled Pines Nursing Center",
    type: "nursing home",
    website: "https://troubledpines.example.com",
    phone: "(419) 555-0166",
    address: "3 Pine Hollow Ln",
    city: "Toledo",
    state: "OH",
    postalCode: "43604",
    ccn: "365999",
    npi: "1093744444",
    placeId: "mock_place_pines",
    bedCount: 90,
    starRating: 1,
    facilityCount: 1,
    marketingText:
      "Troubled Pines Nursing Center provides long-term care and skilled nursing services.",
    careersText: "Hiring CNAs and LPNs for immediate openings.",
    newsText:
      "Court filings indicate Troubled Pines Nursing Center entered receivership amid a payment dispute and an unpaid collections lawsuit; the state issued a civil monetary penalty following an immediate jeopardy citation.",
  },
  // additional healthcare orgs to give scans volume / density
  {
    id: "evergreen-senior-living",
    name: "Evergreen Senior Living Group",
    type: "assisted living",
    website: "https://evergreenseniorliving.example.com",
    phone: "(614) 555-0120",
    address: "210 Maple Commons",
    city: "Columbus",
    state: "OH",
    postalCode: "43215",
    npi: "1093755555",
    ccn: "365222",
    placeId: "mock_place_evergreen",
    bedCount: 75,
    starRating: 4,
    facilityCount: 9,
    parentCompany: "Evergreen Senior Living Group",
    marketingText:
      "Evergreen Senior Living Group operates assisted living and memory care communities across Ohio. Our locations share a leadership team focused on quality and compliance.",
    careersText: "We are hiring CNAs and caregivers across our communities. Reduce agency dependence with us.",
    newsText: "Evergreen announced an acquisition of two additional communities, continuing its expansion.",
  },
  {
    id: "riverbend-rehab",
    name: "Riverbend Rehabilitation & Nursing",
    type: "rehab facility",
    website: "https://riverbendrehab.example.com",
    phone: "(517) 555-0190",
    address: "88 River Rd",
    city: "Lansing",
    state: "MI",
    postalCode: "48933",
    ccn: "235777",
    npi: "1093766666",
    placeId: "mock_place_riverbend",
    bedCount: 110,
    starRating: 3,
    facilityCount: 3,
    marketingText:
      "Riverbend Rehabilitation & Nursing offers post-acute rehabilitation and skilled nursing with a focus on operational excellence.",
    careersText: "Now hiring RNs and LPNs for weekend staffing and call-off coverage.",
  },
  {
    id: "harbor-home-health",
    name: "Harbor Home Health Services",
    type: "home health agency",
    website: "https://harborhomehealth.example.com",
    phone: "(281) 555-0177",
    address: "640 Bayou St",
    city: "Houston",
    state: "TX",
    postalCode: "77002",
    npi: "1093777777",
    placeId: "mock_place_harbor",
    facilityCount: 4,
    marketingText:
      "Harbor Home Health Services is a Medicare-certified home health agency serving the greater Houston area with multiple branch locations.",
    careersText: "Hiring HHAs and RNs. Help us cover weekend visits and reduce contract labor.",
  },
];

const GENERIC_TYPE_TEXT: Record<string, string> = {
  company: "is a regional company serving business customers with a growing team.",
  "local service business": "is an established local service business serving its community.",
  manufacturer: "is a manufacturer producing industrial products with multiple shifts.",
  distributor: "is a distributor supplying regional customers across several locations.",
  "independent operator": "is a founder-owned independent operator with recurring revenue.",
};

function makeGenericOrg(type: string, state: string, idx: number): Omit<MockOrg, "lat" | "lng"> {
  const cityList = ["Springfield", "Riverside", "Fairview", "Madison", "Georgetown", "Clinton"];
  const city = cityList[idx % cityList.length];
  const name = `${city} ${titleType(type)} ${idx + 1}`;
  const domain = `${slugify(name)}.example.com`;
  const hiring = idx % 2 === 0 ? "We are now hiring and expanding our team." : "";
  return {
    id: slugify(name),
    name,
    type,
    website: `https://${domain}`,
    phone: `(555) 555-${(1000 + idx).toString().slice(-4)}`,
    address: `${100 + idx} Main St`,
    city,
    state,
    postalCode: `${10000 + idx * 7}`.slice(0, 5),
    facilityCount: (idx % 3) + 1,
    marketingText: `${name} ${GENERIC_TYPE_TEXT[type] ?? "is an organization matching the target profile."} ${hiring}`,
    careersText: hiring ? "Careers: open positions available. Apply now." : undefined,
  };
}

function titleType(type: string): string {
  return type
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function attachCoords(org: Omit<MockOrg, "lat" | "lng">, seed: number): MockOrg {
  const center = STATE_CENTERS[org.state] ?? [39.5, -98.35];
  return { ...org, lat: jitter(seed, center[0]), lng: jitter(seed + 1, center[1]) };
}

/**
 * Build the mock universe for a scan based on the ICP context.
 * Healthcare/Quinable modes get the named demo orgs (filtered to states when
 * provided); all modes get procedurally generated orgs to ensure volume.
 */
export function buildMockUniverse(ctx: ConnectorContext): MockOrg[] {
  const states = ctx.states.length ? ctx.states.map((s) => s.toUpperCase()) : ["MI", "TX", "OH"];
  const orgs: MockOrg[] = [];
  let seed = 1;

  const healthcareish = ["quinable", "healthcare"].includes(ctx.mode) ||
    ctx.organizationTypes.some((t) => /nursing|assisted|memory|rehab|home health|hospice|senior|skilled/i.test(t));

  if (healthcareish) {
    for (const base of NAMED_HEALTHCARE) {
      if (states.includes(base.state)) orgs.push(attachCoords(base, seed++));
    }
    // If user picked states with no named orgs, still surface a couple by relocating.
    if (orgs.length < 3) {
      for (const base of NAMED_HEALTHCARE.slice(0, 4)) {
        orgs.push(attachCoords({ ...base, state: states[0], city: base.city }, seed++));
      }
    }
  }

  // procedural fill
  const types = ctx.organizationTypes.length ? ctx.organizationTypes : ["company"];
  const targetCount = Math.min(ctx.maxRecords, 60);
  let i = 0;
  while (orgs.length < targetCount) {
    const type = types[i % types.length];
    const state = states[i % states.length];
    orgs.push(attachCoords(makeGenericOrg(type, state, i), seed++));
    i++;
    if (i > 200) break;
  }

  return orgs.slice(0, ctx.maxRecords);
}

export function orgDomain(org: MockOrg): string | null {
  return extractDomain(org.website);
}

// Lookup used by the mock website crawler during enrichment.
let cachedUniverse: MockOrg[] | null = null;
export function indexUniverse(orgs: MockOrg[]): void {
  cachedUniverse = orgs;
}
export function findOrgByDomain(domain: string): MockOrg | undefined {
  if (!cachedUniverse) return undefined;
  return cachedUniverse.find((o) => orgDomain(o) === domain);
}
