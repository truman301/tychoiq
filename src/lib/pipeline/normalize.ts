import type { RawSourceRecord } from "@/lib/types";
import { extractDomain, normalizeName, normalizePhone, normalizeAddressKey } from "@/lib/text";

export type NormalizedRecord = RawSourceRecord & {
  id: string;
  normalizedName: string;
  domain: string | null;
  phoneKey: string | null;
  addressKey: string | null;
  npi: string | null;
  ccn: string | null;
  placeId: string | null;
};

// Normalize a raw connector record: compute dedup keys + canonical name/domain.
export function normalizeRecord(raw: RawSourceRecord, id: string): NormalizedRecord {
  const ids = raw.externalIds ?? {};
  return {
    ...raw,
    id,
    normalizedName: normalizeName(raw.organizationName ?? raw.rawTitle ?? ""),
    domain: extractDomain(raw.website),
    phoneKey: normalizePhone(raw.phone),
    addressKey: normalizeAddressKey({
      address: raw.address,
      city: raw.city,
      state: raw.state,
      postalCode: raw.postalCode,
    }),
    npi: (ids.npi as string) ?? null,
    ccn: (ids.ccn as string) ?? (ids.cms_ccn as string) ?? null,
    placeId: (ids.placeId as string) ?? (ids.place_id as string) ?? null,
  };
}

export function normalizeAll(raws: { raw: RawSourceRecord; id: string }[]): NormalizedRecord[] {
  return raws.map(({ raw, id }) => normalizeRecord(raw, id));
}
