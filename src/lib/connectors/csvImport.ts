import Papa from "papaparse";
import type { RawSourceRecord } from "@/lib/types";

// CSV import connector (spec 4.4.5 / Phase 3). Maps flexible column names to the
// normalized RawSourceRecord shape. Works for user-supplied lists, Clay/Apollo/
// ZoomInfo exports, etc. (the user's own authorized data).

const COLUMN_ALIASES: Record<keyof RawSourceRecord, string[]> = {
  organizationName: ["name", "organization", "organization_name", "company", "company_name", "facility", "facility_name", "account", "account_name"],
  website: ["website", "url", "domain", "company_website", "web"],
  phone: ["phone", "phone_number", "telephone", "tel"],
  email: ["email", "email_address"],
  address: ["address", "street", "address1", "address_line_1", "street_address"],
  city: ["city", "town"],
  state: ["state", "province", "region", "st"],
  postalCode: ["zip", "zipcode", "zip_code", "postal", "postal_code", "postalcode"],
  country: ["country"],
  latitude: ["lat", "latitude"],
  longitude: ["lng", "lon", "long", "longitude"],
  rawTitle: ["title"],
  rawText: ["description", "notes", "summary", "about"],
  // not aliased directly:
  sourceType: [],
  sourceName: [],
  sourceUrl: [],
  retrievedAt: [],
  rawJson: [],
  externalIds: [],
};

function canon(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, "_");
}

function pick(row: Record<string, string>, aliases: string[]): string | undefined {
  const keys = Object.keys(row);
  for (const alias of aliases) {
    const match = keys.find((k) => canon(k) === alias);
    if (match && row[match]?.trim()) return row[match].trim();
  }
  return undefined;
}

export function parseCsvToRecords(csv: string, sourceName = "CSV Import"): RawSourceRecord[] {
  const parsed = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  const now = new Date().toISOString();
  const records: RawSourceRecord[] = [];

  for (const row of parsed.data) {
    if (!row || typeof row !== "object") continue;
    const name = pick(row, COLUMN_ALIASES.organizationName);
    if (!name) continue;
    const lat = pick(row, COLUMN_ALIASES.latitude);
    const lng = pick(row, COLUMN_ALIASES.longitude);
    const externalIds: Record<string, string> = {};
    for (const idKey of ["npi", "ccn", "cms_ccn", "place_id", "placeid"]) {
      const v = pick(row, [idKey]);
      if (v) externalIds[idKey.replace("cms_", "").replace("place_id", "placeId").replace("placeid", "placeId")] = v;
    }
    records.push({
      sourceType: "import",
      sourceName,
      retrievedAt: now,
      rawTitle: name,
      rawText: pick(row, COLUMN_ALIASES.rawText) ?? `${name} (imported)`,
      rawJson: row,
      organizationName: name,
      website: pick(row, COLUMN_ALIASES.website),
      phone: pick(row, COLUMN_ALIASES.phone),
      email: pick(row, COLUMN_ALIASES.email),
      address: pick(row, COLUMN_ALIASES.address),
      city: pick(row, COLUMN_ALIASES.city),
      state: pick(row, COLUMN_ALIASES.state),
      postalCode: pick(row, COLUMN_ALIASES.postalCode),
      country: pick(row, COLUMN_ALIASES.country) ?? "US",
      latitude: lat ? Number(lat) : undefined,
      longitude: lng ? Number(lng) : undefined,
      externalIds: Object.keys(externalIds).length ? externalIds : undefined,
    });
  }
  return records;
}
