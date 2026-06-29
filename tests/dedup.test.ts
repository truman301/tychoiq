import { describe, it, expect } from "vitest";
import { dedupeRecords, type DedupRecord } from "@/lib/pipeline/dedup";

function rec(p: Partial<DedupRecord> & { id: string; name: string }): DedupRecord {
  return { normalizedName: p.name.toLowerCase(), ...p } as DedupRecord;
}

describe("deduplication", () => {
  it("merges records sharing a domain", () => {
    const clusters = dedupeRecords([
      rec({ id: "1", name: "Lakeside Post-Acute", domain: "lakeside.com" }),
      rec({ id: "2", name: "Lakeside Post Acute Center", domain: "lakeside.com" }),
      rec({ id: "3", name: "Different Co", domain: "other.com" }),
    ]);
    expect(clusters.length).toBe(2);
    const big = clusters.find((c) => c.length === 2);
    expect(big?.map((r) => r.id).sort()).toEqual(["1", "2"]);
  });

  it("merges by CCN / NPI / placeId even with different formatting", () => {
    const clusters = dedupeRecords([
      rec({ id: "a", name: "Riverbend Rehab", ccn: "235777" }),
      rec({ id: "b", name: "Riverbend Rehabilitation and Nursing", ccn: "235777" }),
      rec({ id: "c", name: "Riverbend", npi: "1093766666" }),
      rec({ id: "d", name: "Riverbend Rehab", placeId: "p1", npi: "1093766666" }),
    ]);
    // a+b via ccn, c+d via npi — but b and c share neither key nor strong fuzzy+geo
    // they remain separate unless fuzzy matches; ensure ccn and npi grouped correctly
    const ids = clusters.map((c) => c.map((r) => r.id).sort());
    expect(ids.some((g) => g.includes("a") && g.includes("b"))).toBe(true);
    expect(ids.some((g) => g.includes("c") && g.includes("d"))).toBe(true);
  });

  it("merges by phone and by address key", () => {
    const clusters = dedupeRecords([
      rec({ id: "1", name: "Acme A", phoneKey: "6165550142" }),
      rec({ id: "2", name: "Acme B", phoneKey: "6165550142" }),
      rec({ id: "3", name: "Foo", addressKey: "100 main st|grand rapids|mi|49503" }),
      rec({ id: "4", name: "Bar", addressKey: "100 main st|grand rapids|mi|49503" }),
    ]);
    expect(clusters.length).toBe(2);
  });

  it("uses fuzzy name + geo proximity as a fallback", () => {
    const clusters = dedupeRecords([
      rec({ id: "1", name: "Evergreen Senior Living Group", latitude: 40.0, longitude: -83.0, city: "Columbus", state: "OH" }),
      rec({ id: "2", name: "Evergreen Senior Living", latitude: 40.01, longitude: -83.01, city: "Columbus", state: "OH" }),
    ]);
    expect(clusters.length).toBe(1);
  });

  it("does NOT merge similar names that are far apart", () => {
    const clusters = dedupeRecords([
      rec({ id: "1", name: "Sunrise Memory Care", latitude: 33.0, longitude: -96.0, city: "Plano", state: "TX" }),
      rec({ id: "2", name: "Sunrise Memory Care", latitude: 42.0, longitude: -85.0, city: "Grand Rapids", state: "MI" }),
    ]);
    expect(clusters.length).toBe(2);
  });

  it("keeps distinct organizations separate", () => {
    const clusters = dedupeRecords([
      rec({ id: "1", name: "Alpha Care", domain: "alpha.com" }),
      rec({ id: "2", name: "Beta Health", domain: "beta.com" }),
      rec({ id: "3", name: "Gamma Living", domain: "gamma.com" }),
    ]);
    expect(clusters.length).toBe(3);
  });
});
