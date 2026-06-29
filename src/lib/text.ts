// Text normalization + fuzzy matching utilities used by normalization,
// deduplication, and search-plan generation.

const ORG_STOPWORDS = [
  "inc",
  "llc",
  "llp",
  "ltd",
  "co",
  "corp",
  "corporation",
  "company",
  "the",
  "group",
  "holdings",
  "of",
  "and",
  "center",
  "centre",
];

export function normalizeName(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((tok) => tok && !ORG_STOPWORDS.includes(tok))
    .join(" ")
    .trim();
}

export function extractDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  let value = url.trim().toLowerCase();
  if (!value) return null;
  if (!/^https?:\/\//.test(value)) value = `https://${value}`;
  try {
    const host = new URL(value).hostname.replace(/^www\./, "");
    return host || null;
  } catch {
    return null;
  }
}

export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return null;
  // Keep last 10 digits (US-centric MVP); document for international later.
  return digits.slice(-10);
}

export function normalizeAddressKey(parts: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
}): string | null {
  const street = (parts.address ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(suite|ste|unit|apt|floor|fl)\b.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  const city = (parts.city ?? "").toLowerCase().trim();
  const state = (parts.state ?? "").toLowerCase().trim();
  const zip = (parts.postalCode ?? "").replace(/\D/g, "").slice(0, 5);
  const key = [street, city, state, zip].filter(Boolean).join("|");
  return key || null;
}

// Token-set Jaccard similarity, robust for short org names.
export function nameSimilarity(a: string, b: string): number {
  const sa = new Set(normalizeName(a).split(" ").filter(Boolean));
  const sb = new Set(normalizeName(b).split(" ").filter(Boolean));
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const tok of sa) if (sb.has(tok)) inter += 1;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function haversineMiles(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 3958.8; // earth radius in miles
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
