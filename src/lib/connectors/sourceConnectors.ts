import type { RawSourceRecord } from "@/lib/types";
import type { ConnectorContext, SourceConnector } from "@/lib/connectors/types";
import { buildMockUniverse, indexUniverse, type MockOrg } from "@/lib/connectors/mockUniverse";
import { env } from "@/lib/env";

const now = () => new Date().toISOString();

// Each connector projects the shared mock universe but exposes only the fields
// it would realistically provide — creating natural cross-source duplicates and
// partial records for the dedup + multi-source-evidence pipeline.

function universe(ctx: ConnectorContext): MockOrg[] {
  const orgs = buildMockUniverse(ctx);
  indexUniverse(orgs); // make available to the website crawler during enrichment
  return orgs;
}

// 4.4.1 Search APIs (Brave/SerpAPI/Bing/Google CSE) — query discovery only.
export class SearchConnector implements SourceConnector {
  key = "brave_search";
  name = "Web Search (Brave/SerpAPI/Bing/Google CSE)";
  category = "search" as const;

  async discover(ctx: ConnectorContext): Promise<RawSourceRecord[]> {
    if (!ctx.mock && env.search.brave) {
      // TODO(real-api): call Brave Search API (or configured provider) with the
      // ICP-driven query plan from lib/llm/queryGen.ts, then map result snippets
      // into RawSourceRecord. Use these for *discovery*, not result-page scraping.
      return [];
    }
    return universe(ctx)
      .filter((o) => o.website)
      .map((o) => ({
        sourceType: "search",
        sourceName: "Web Search (mock)",
        sourceUrl: o.website,
        retrievedAt: now(),
        rawTitle: o.name,
        rawText: o.marketingText,
        organizationName: o.name,
        website: o.website,
      }));
  }
}

// 4.4.2 Maps & local data (Google Places / OSM Overpass).
export class PlacesConnector implements SourceConnector {
  key = "google_places";
  name = "Maps / Local Data (Google Places, OSM Overpass)";
  category = "maps" as const;

  async discover(ctx: ConnectorContext): Promise<RawSourceRecord[]> {
    if (!ctx.mock && (env.maps.googlePlaces || env.maps.overpassUrl)) {
      // TODO(real-api): use Google Places Text Search / Nearby Search or an
      // Overpass query (amenity=nursing_home, social_facility, etc.) per region
      // grid; map place results to RawSourceRecord with lat/lng + place_id.
      return [];
    }
    return universe(ctx).map((o) => ({
      sourceType: "maps",
      sourceName: "Local Places (mock)",
      sourceUrl: undefined,
      retrievedAt: now(),
      rawTitle: o.name,
      rawText: `${o.name} — ${o.type} in ${o.city}, ${o.state}`,
      organizationName: o.name,
      website: o.website,
      phone: o.phone,
      address: o.address,
      city: o.city,
      state: o.state,
      postalCode: o.postalCode,
      country: "US",
      latitude: o.lat,
      longitude: o.lng,
      externalIds: o.placeId ? { placeId: o.placeId } : undefined,
    }));
  }
}

// 4.4.3 Government datasets — CMS Provider Data (authoritative for healthcare).
export class CmsConnector implements SourceConnector {
  key = "cms_provider";
  name = "CMS Provider Data Catalog";
  category = "gov" as const;
  authoritative = true;

  async discover(ctx: ConnectorContext): Promise<RawSourceRecord[]> {
    if (!ctx.mock && env.gov.cmsBase) {
      // TODO(real-api): query CMS Provider Data Catalog datasets (nursing homes,
      // Care Compare, PBJ staffing, ownership) via data.cms.gov; filter by state;
      // map provider rows to RawSourceRecord including CCN, bed count, star rating.
      return [];
    }
    // Only facilities with a CCN are in CMS data.
    return universe(ctx)
      .filter((o) => o.ccn)
      .map((o) => ({
        sourceType: "gov_dataset",
        sourceName: "CMS Provider Data Catalog (mock)",
        sourceUrl: "https://data.cms.gov/provider-data",
        retrievedAt: now(),
        rawTitle: o.name,
        rawText: `CMS provider record for ${o.name}. Certified beds: ${o.bedCount ?? "n/a"}. Overall rating: ${o.starRating ?? "n/a"} stars.`,
        rawJson: {
          ccn: o.ccn,
          certified_beds: o.bedCount,
          overall_rating: o.starRating,
          provider_type: o.type,
        },
        organizationName: o.name,
        address: o.address,
        city: o.city,
        state: o.state,
        postalCode: o.postalCode,
        country: "US",
        externalIds: { ccn: o.ccn! },
      }));
  }
}

// 4.4.3 NPPES NPI Registry (authoritative org identity).
export class NppesConnector implements SourceConnector {
  key = "nppes";
  name = "NPPES NPI Registry";
  category = "gov" as const;
  authoritative = true;

  async discover(ctx: ConnectorContext): Promise<RawSourceRecord[]> {
    if (!ctx.mock && env.gov.nppesBase) {
      // TODO(real-api): call https://npiregistry.cms.hhs.gov/api with
      // enumeration_type=NPI-2 (orgs) + taxonomy + state filters; map to records.
      return [];
    }
    return universe(ctx)
      .filter((o) => o.npi)
      .map((o) => ({
        sourceType: "gov_dataset",
        sourceName: "NPPES NPI Registry (mock)",
        sourceUrl: "https://npiregistry.cms.hhs.gov",
        retrievedAt: now(),
        rawTitle: o.name,
        rawText: `NPPES organizational provider ${o.name}, NPI ${o.npi}, taxonomy: ${o.type}.`,
        rawJson: { npi: o.npi, taxonomy: o.type },
        organizationName: o.name,
        address: o.address,
        city: o.city,
        state: o.state,
        postalCode: o.postalCode,
        country: "US",
        externalIds: { npi: o.npi! },
      }));
  }
}

// 4.4.5 / Phase 3 — user-supplied records (CSV import / manual add).
export class ImportConnector implements SourceConnector {
  key = "csv_import";
  name = "CSV Import / Manual Add";
  category = "import" as const;

  async discover(ctx: ConnectorContext): Promise<RawSourceRecord[]> {
    return ctx.importedRecords ?? [];
  }
}

export const DISCOVERY_CONNECTORS: SourceConnector[] = [
  new ImportConnector(),
  new SearchConnector(),
  new PlacesConnector(),
  new CmsConnector(),
  new NppesConnector(),
];
