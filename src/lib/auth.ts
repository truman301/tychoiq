import { scryptSync, randomBytes, timingSafeEqual, createHmac } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { slugify } from "@/lib/text";
import { SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/authConstants";

// Lightweight email+password auth with HMAC-signed session cookies. No external
// dependencies — uses node:crypto (scrypt for passwords, HMAC-SHA256 for the
// session token). Suitable for a self-hosted multi-user deployment.
// NOTE: this module is Node-only (node:crypto); never import it from middleware.

export { SESSION_COOKIE };

// --- password hashing -------------------------------------------------------
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const [scheme, salt, hash] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const derived = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

// --- session token (signed) -------------------------------------------------
function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

export function signSession(userId: string): string {
  const payload = { uid: userId, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS };
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", env.authSecret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifySessionToken(token: string | undefined | null): { uid: string } | null {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const expected = createHmac("sha256", env.authSecret).update(body).digest("base64url");
  // constant-time compare
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as { uid: string; exp: number };
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return { uid: payload.uid };
  } catch {
    return null;
  }
}

export function sessionCookieOptions(maxAge = SESSION_TTL_SECONDS) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    // Mark Secure only when the app is actually served over HTTPS (derived from
    // APP_URL). Correct for local HTTP dev AND for HTTPS behind a proxy.
    secure: env.appUrl.startsWith("https"),
    path: "/",
    maxAge,
  };
}

// --- session reads (server components / route handlers) ---------------------
export async function getSessionUser() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const verified = verifySessionToken(token);
  if (!verified) return null;
  return prisma.user.findUnique({ where: { id: verified.uid } });
}

export type SessionContext = {
  user: NonNullable<Awaited<ReturnType<typeof getSessionUser>>>;
  workspaceId: string;
};

// Returns the authenticated user + their primary workspace, or null.
export async function getSessionContext(): Promise<SessionContext | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const membership = await prisma.workspaceMember.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });
  if (!membership) return null;
  return { user, workspaceId: membership.workspaceId };
}

// --- signup helper ----------------------------------------------------------
const DEFAULT_CONNECTORS = [
  { key: "csv_import", name: "CSV Import", category: "import", enabled: true, mock: true },
  { key: "manual", name: "Manual Candidate Add", category: "import", enabled: true, mock: true },
  { key: "brave_search", name: "Web Search (Brave/SerpAPI/Bing/Google CSE)", category: "search", enabled: true, mock: true },
  { key: "google_places", name: "Maps / Local Data (Google Places, OSM)", category: "maps", enabled: true, mock: true },
  { key: "osm_overpass", name: "OpenStreetMap Overpass", category: "maps", enabled: false, mock: true },
  { key: "cms_provider", name: "CMS Provider Data Catalog", category: "gov", enabled: true, mock: true },
  { key: "nppes", name: "NPPES NPI Registry", category: "gov", enabled: true, mock: true },
  { key: "website_crawl", name: "Website Crawler (permitted pages)", category: "crawl", enabled: true, mock: true },
];

export async function createUserWithWorkspace(input: { email: string; password: string; name?: string }) {
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("An account with that email already exists.");

  const baseSlug = slugify(input.name || email.split("@")[0]) || "workspace";
  // ensure unique slug
  let slug = baseSlug;
  for (let i = 1; await prisma.workspace.findUnique({ where: { slug } }); i++) slug = `${baseSlug}-${i}`;

  const user = await prisma.user.create({
    data: {
      email,
      name: input.name,
      passwordHash: hashPassword(input.password),
      memberships: {
        create: {
          role: "admin",
          workspace: {
            create: {
              name: input.name ? `${input.name}'s Workspace` : "My Workspace",
              slug,
              connectors: { create: DEFAULT_CONNECTORS },
            },
          },
        },
      },
    },
  });
  return user;
}
