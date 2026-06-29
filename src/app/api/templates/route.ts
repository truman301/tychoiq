import { ok } from "@/lib/api";
import { PROJECT_TEMPLATES } from "@/lib/templates";

export const dynamic = "force-dynamic";

export async function GET() {
  return ok(
    PROJECT_TEMPLATES.map((t) => ({
      key: t.key,
      name: t.name,
      description: t.description,
      mode: t.mode,
      industry: t.industry,
      organizationTypes: t.icp.organizationTypesInclude,
      geography: t.icp.geography,
    })),
  );
}
