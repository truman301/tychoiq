import { describe, it, expect } from "vitest";
import { normalizeRecord } from "@/lib/pipeline/normalize";
import { normalizeName, extractDomain, normalizePhone, nameSimilarity } from "@/lib/text";
import { parseCsvToRecords } from "@/lib/connectors/csvImport";

describe("text normalization", () => {
  it("normalizes org names by stripping suffixes/punctuation/stopwords", () => {
    expect(normalizeName("Lakeside Post-Acute Center, LLC")).toBe("lakeside post acute");
    expect(normalizeName("The Evergreen Group Inc.")).toBe("evergreen");
  });

  it("extracts bare domains from urls", () => {
    expect(extractDomain("https://www.Lakeside.com/about")).toBe("lakeside.com");
    expect(extractDomain("lakeside.com")).toBe("lakeside.com");
    expect(extractDomain("")).toBeNull();
  });

  it("normalizes US phone numbers to 10 digits", () => {
    expect(normalizePhone("(616) 555-0142")).toBe("6165550142");
    expect(normalizePhone("+1 616 555 0142")).toBe("6165550142");
    expect(normalizePhone("123")).toBeNull();
  });

  it("computes token-set name similarity", () => {
    expect(nameSimilarity("Riverbend Rehabilitation and Nursing", "Riverbend Rehab Nursing")).toBeGreaterThan(0.4);
    expect(nameSimilarity("Alpha Care", "Zeta Logistics")).toBe(0);
  });
});

describe("source record normalization", () => {
  it("computes dedup keys from a raw record", () => {
    const n = normalizeRecord(
      {
        sourceType: "maps",
        sourceName: "Places",
        retrievedAt: new Date().toISOString(),
        organizationName: "Lakeside Post-Acute Center",
        website: "https://lakeside.com",
        phone: "(616) 555-0142",
        address: "1200 Lakeshore Dr",
        city: "Grand Rapids",
        state: "MI",
        postalCode: "49503",
        externalIds: { ccn: "235123", npi: "1093711111" },
      },
      "rec1",
    );
    expect(n.domain).toBe("lakeside.com");
    expect(n.phoneKey).toBe("6165550142");
    expect(n.ccn).toBe("235123");
    expect(n.npi).toBe("1093711111");
    expect(n.normalizedName).toContain("lakeside");
  });
});

describe("CSV import", () => {
  it("maps flexible columns to normalized records", () => {
    const csv = "Company Name,Website,City,ST,Phone\nAcme Care Center,acmecare.com,Austin,TX,512-555-1212";
    const records = parseCsvToRecords(csv);
    expect(records).toHaveLength(1);
    expect(records[0].organizationName).toBe("Acme Care Center");
    expect(records[0].website).toBe("acmecare.com");
    expect(records[0].city).toBe("Austin");
    expect(records[0].state).toBe("TX");
  });

  it("skips rows without a name", () => {
    const csv = "name,website\n,nodomain.com\nReal Co,real.com";
    const records = parseCsvToRecords(csv);
    expect(records).toHaveLength(1);
    expect(records[0].organizationName).toBe("Real Co");
  });
});
