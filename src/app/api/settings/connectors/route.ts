import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, handleError } from "@/lib/api";
import { requireSession } from "@/lib/access";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  connectors: z.array(
    z.object({
      key: z.string(),
      enabled: z.boolean().optional(),
      mock: z.boolean().optional(),
    }),
  ),
});

// Indicates whether a real API key is present for a connector (drives mock badges).
function keyStatus() {
  return {
    brave_search: !!env.search.brave || !!env.search.serpapi || !!env.search.bing || !!env.search.googleCseKey,
    google_places: !!env.maps.googlePlaces,
    osm_overpass: !!env.maps.overpassUrl,
    cms_provider: true, // public dataset (no key)
    nppes: true, // public API (no key)
    website_crawl: true,
    csv_import: true,
    manual: true,
  } as Record<string, boolean>;
}

export async function GET() {
  try {
    const { workspaceId } = await requireSession();
    const connectors = await prisma.sourceConnector.findMany({
      where: { workspaceId },
      orderBy: { category: "asc" },
    });
    return ok({
      connectors,
      mockMode: env.mockMode,
      llmProvider: env.llmProvider,
      embeddingsProvider: env.embeddingsProvider,
      keyAvailable: keyStatus(),
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const body = PatchSchema.parse(await req.json());
    const { workspaceId } = await requireSession();
    for (const c of body.connectors) {
      await prisma.sourceConnector.updateMany({
        where: { workspaceId, key: c.key },
        data: { enabled: c.enabled, mock: c.mock },
      });
    }
    const connectors = await prisma.sourceConnector.findMany({ where: { workspaceId } });
    return ok({ connectors });
  } catch (err) {
    return handleError(err);
  }
}
