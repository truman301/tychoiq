import { env } from "@/lib/env";
import { extractDomain } from "@/lib/text";
import { findOrgByDomain } from "@/lib/connectors/mockUniverse";

// Permitted, rate-limited, robots-aware website crawl (spec 3.5 / 4.4.4 / 8).
// Crawls only public marketing/careers/about/news pages. In mock mode it returns
// synthetic page text from the mock universe so enrichment runs fully offline.

export type CrawlHints = {
  organizationType?: string;
  bedCount?: number;
  starRating?: number;
  facilityCount?: number;
  parentCompany?: string;
};

export type CrawlResult = {
  website: string;
  sourceUrl: string;
  pagesCrawled: number;
  text: string;
  blockedByRobots: boolean;
  // Structured hints available in mock mode (real crawler returns text only).
  hints?: CrawlHints;
};

const PERMITTED_PATHS = [
  "",
  "/about",
  "/locations",
  "/careers",
  "/jobs",
  "/team",
  "/contact",
  "/services",
  "/news",
];

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Minimal robots.txt check (spec compliance). Returns true if path is allowed.
async function robotsAllows(origin: string, path: string): Promise<boolean> {
  if (!env.crawler.respectRobots) return true;
  try {
    const res = await fetch(`${origin}/robots.txt`, {
      headers: { "User-Agent": env.crawler.userAgent },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return true; // no robots.txt => allowed
    const body = await res.text();
    // Very small parser: honour Disallow lines under User-agent: * (or our UA).
    const lines = body.split(/\r?\n/).map((l) => l.trim());
    let applies = false;
    const disallows: string[] = [];
    for (const line of lines) {
      const [rawKey, ...rest] = line.split(":");
      const key = rawKey?.toLowerCase().trim();
      const val = rest.join(":").trim();
      if (key === "user-agent") applies = val === "*" || env.crawler.userAgent.includes(val);
      else if (key === "disallow" && applies && val) disallows.push(val);
    }
    return !disallows.some((d) => path.startsWith(d));
  } catch {
    return true;
  }
}

async function crawlReal(website: string): Promise<CrawlResult> {
  const normalized = /^https?:\/\//.test(website) ? website : `https://${website}`;
  const origin = new URL(normalized).origin;
  const texts: string[] = [];
  let pages = 0;
  let blocked = false;
  const max = env.crawler.maxPagesPerDomain;

  for (const path of PERMITTED_PATHS) {
    if (pages >= max) break;
    const allowed = await robotsAllows(origin, path || "/");
    if (!allowed) {
      blocked = true;
      continue;
    }
    try {
      const res = await fetch(`${origin}${path}`, {
        headers: { "User-Agent": env.crawler.userAgent },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const html = await res.text();
      texts.push(stripHtml(html).slice(0, 4000));
      pages += 1;
      // simple politeness delay
      await new Promise((r) => setTimeout(r, Math.ceil(60000 / env.crawler.requestsPerMinutePerDomain)));
    } catch {
      // ignore individual page failures
    }
  }

  return { website: normalized, sourceUrl: normalized, pagesCrawled: pages, text: texts.join("\n\n"), blockedByRobots: blocked };
}

function crawlMock(website: string): CrawlResult {
  const domain = extractDomain(website) ?? website;
  const org = findOrgByDomain(domain);
  const parts = [org?.marketingText, org?.careersText, org?.newsText].filter(Boolean);
  return {
    website: org?.website ?? website,
    sourceUrl: org?.website ?? website,
    pagesCrawled: parts.length,
    text: parts.join("\n\n") || `No public page content available for ${domain} (mock).`,
    blockedByRobots: false,
    hints: org
      ? {
          organizationType: org.type,
          bedCount: org.bedCount,
          starRating: org.starRating,
          facilityCount: org.facilityCount,
          parentCompany: org.parentCompany,
        }
      : undefined,
  };
}

export async function crawlWebsite(website: string, mock: boolean): Promise<CrawlResult> {
  if (mock || env.mockMode) return crawlMock(website);
  try {
    return await crawlReal(website);
  } catch {
    return crawlMock(website);
  }
}
