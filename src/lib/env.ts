// Centralised, typed access to environment configuration. Reads at call time
// so changes to `.env` are picked up on server restart.

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value == null) return fallback;
  return value.toLowerCase() === "true" || value === "1";
}

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export const env = {
  get mockMode(): boolean {
    return bool(process.env.MOCK_MODE, true);
  },
  get llmProvider(): "mock" | "anthropic" | "openai" {
    const p = (process.env.LLM_PROVIDER ?? "mock").toLowerCase();
    return p === "anthropic" || p === "openai" ? p : "mock";
  },
  get anthropicApiKey() {
    return process.env.ANTHROPIC_API_KEY ?? "";
  },
  get anthropicModel() {
    return process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";
  },
  get openaiApiKey() {
    return process.env.OPENAI_API_KEY ?? "";
  },
  get openaiModel() {
    return process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  },
  get embeddingsProvider(): "mock" | "openai" {
    return (process.env.EMBEDDINGS_PROVIDER ?? "mock").toLowerCase() === "openai"
      ? "openai"
      : "mock";
  },
  get openaiEmbeddingsModel() {
    return process.env.OPENAI_EMBEDDINGS_MODEL ?? "text-embedding-3-small";
  },
  search: {
    get brave() {
      return process.env.BRAVE_SEARCH_API_KEY ?? "";
    },
    get serpapi() {
      return process.env.SERPAPI_API_KEY ?? "";
    },
    get bing() {
      return process.env.BING_SEARCH_API_KEY ?? "";
    },
    get googleCseKey() {
      return process.env.GOOGLE_CSE_API_KEY ?? "";
    },
    get googleCseCx() {
      return process.env.GOOGLE_CSE_CX ?? "";
    },
  },
  maps: {
    get googlePlaces() {
      return process.env.GOOGLE_PLACES_API_KEY ?? "";
    },
    get mapbox() {
      return process.env.MAPBOX_TOKEN ?? "";
    },
    get overpassUrl() {
      return process.env.OVERPASS_API_URL ?? "https://overpass-api.de/api/interpreter";
    },
  },
  gov: {
    get cmsBase() {
      return process.env.CMS_PROVIDER_DATA_BASE ?? "https://data.cms.gov/provider-data/api/1";
    },
    get nppesBase() {
      return process.env.NPPES_API_BASE ?? "https://npiregistry.cms.hhs.gov/api";
    },
  },
  crawler: {
    get userAgent() {
      return process.env.CRAWLER_USER_AGENT ?? "TychoIQ/0.1";
    },
    get respectRobots() {
      return bool(process.env.CRAWLER_RESPECT_ROBOTS, true);
    },
    get maxPagesPerDomain() {
      return num(process.env.CRAWLER_MAX_PAGES_PER_DOMAIN, 8);
    },
    get requestsPerMinutePerDomain() {
      return num(process.env.CRAWLER_REQUESTS_PER_MINUTE_PER_DOMAIN, 20);
    },
  },
  get defaultUserEmail() {
    return process.env.DEFAULT_USER_EMAIL ?? "admin@local";
  },
  get defaultUserName() {
    return process.env.DEFAULT_USER_NAME ?? "Local Admin";
  },
  // Auth (public multi-user mode). AUTH_SECRET signs session cookies — MUST be
  // set to a long random string in production.
  get authSecret() {
    return process.env.AUTH_SECRET ?? "dev-insecure-secret-change-me";
  },
  get appUrl() {
    return process.env.APP_URL ?? "http://localhost:3000";
  },
  // When true, /signup is disabled (invite-only / single-tenant lockdown).
  get disableSignup() {
    return (process.env.DISABLE_SIGNUP ?? "false").toLowerCase() === "true";
  },
};
