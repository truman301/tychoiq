import type { RawSourceRecord } from "@/lib/types";

export type ConnectorCategory = "search" | "maps" | "gov" | "crawl" | "import" | "enrichment";

export type ConnectorContext = {
  mode: string;
  organizationTypes: string[];
  states: string[];
  cities: string[];
  regionLabel: string;
  maxRecords: number;
  mock: boolean;
  // Records supplied by the user (CSV import / manual add) for the ImportConnector.
  importedRecords?: RawSourceRecord[];
};

export interface SourceConnector {
  key: string;
  name: string;
  category: ConnectorCategory;
  // Whether this connector is authoritative (e.g. CMS, NPPES) for the quality gate.
  authoritative?: boolean;
  discover(ctx: ConnectorContext): Promise<RawSourceRecord[]>;
}

export const CONNECTOR_REGISTRY_KEYS = [
  "csv_import",
  "manual",
  "brave_search",
  "google_places",
  "osm_overpass",
  "cms_provider",
  "nppes",
  "website_crawl",
] as const;
