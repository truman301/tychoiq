import { haversineMiles, nameSimilarity } from "@/lib/text";

// Entity resolution / deduplication (spec 4.5). Clusters records that refer to
// the same organization using strong keys (domain, NPI, CCN, place_id, phone,
// address) and a fuzzy name+geo fallback. Pure + testable.

export type DedupRecord = {
  id: string;
  name: string;
  normalizedName: string;
  domain?: string | null;
  phoneKey?: string | null;
  addressKey?: string | null;
  npi?: string | null;
  ccn?: string | null;
  placeId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  city?: string | null;
  state?: string | null;
};

class UnionFind {
  parent: number[];
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
  }
  find(x: number): number {
    while (this.parent[x] !== x) {
      this.parent[x] = this.parent[this.parent[x]];
      x = this.parent[x];
    }
    return x;
  }
  union(a: number, b: number): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent[Math.max(ra, rb)] = Math.min(ra, rb);
  }
}

const NAME_SIM_THRESHOLD = 0.8;
const GEO_RADIUS_MILES = 25;

function strongKeyMatch(a: DedupRecord, b: DedupRecord): boolean {
  if (a.domain && b.domain && a.domain === b.domain) return true;
  if (a.npi && b.npi && a.npi === b.npi) return true;
  if (a.ccn && b.ccn && a.ccn === b.ccn) return true;
  if (a.placeId && b.placeId && a.placeId === b.placeId) return true;
  if (a.phoneKey && b.phoneKey && a.phoneKey === b.phoneKey) return true;
  if (a.addressKey && b.addressKey && a.addressKey === b.addressKey) return true;
  return false;
}

function fuzzyMatch(a: DedupRecord, b: DedupRecord): boolean {
  const sim = nameSimilarity(a.name, b.name);
  if (sim < NAME_SIM_THRESHOLD) return false;
  // require a geographic agreement to accept a fuzzy name match
  if (a.latitude != null && a.longitude != null && b.latitude != null && b.longitude != null) {
    return (
      haversineMiles(
        { lat: a.latitude, lng: a.longitude },
        { lat: b.latitude, lng: b.longitude },
      ) <= GEO_RADIUS_MILES
    );
  }
  if (a.city && b.city && a.state && b.state) {
    return a.city.toLowerCase() === b.city.toLowerCase() && a.state.toLowerCase() === b.state.toLowerCase();
  }
  // no geo to corroborate — accept only on a very strong name match
  return sim >= 0.95;
}

export function dedupeRecords(records: DedupRecord[]): DedupRecord[][] {
  const n = records.length;
  const uf = new UnionFind(n);

  // index strong keys for O(n) grouping where possible
  const keyIndex = new Map<string, number>();
  const addKey = (key: string | null | undefined, i: number) => {
    if (!key) return;
    const existing = keyIndex.get(key);
    if (existing != null) uf.union(existing, i);
    else keyIndex.set(key, i);
  };

  for (let i = 0; i < n; i++) {
    const r = records[i];
    addKey(r.domain ? `d:${r.domain}` : null, i);
    addKey(r.npi ? `npi:${r.npi}` : null, i);
    addKey(r.ccn ? `ccn:${r.ccn}` : null, i);
    addKey(r.placeId ? `pid:${r.placeId}` : null, i);
    addKey(r.phoneKey ? `ph:${r.phoneKey}` : null, i);
    addKey(r.addressKey ? `addr:${r.addressKey}` : null, i);
  }

  // fuzzy pass (O(n^2) — fine for sample/large-scan chunk sizes)
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (uf.find(i) === uf.find(j)) continue;
      if (strongKeyMatch(records[i], records[j]) || fuzzyMatch(records[i], records[j])) {
        uf.union(i, j);
      }
    }
  }

  const clusters = new Map<number, DedupRecord[]>();
  for (let i = 0; i < n; i++) {
    const root = uf.find(i);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root)!.push(records[i]);
  }
  return [...clusters.values()];
}
