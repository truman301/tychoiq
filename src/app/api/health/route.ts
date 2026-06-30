import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Public health check (no auth) — handy for uptime monitors and Railway/Render
// health checks. Middleware skips all /api/ paths, so this is reachable.
export async function GET() {
  return NextResponse.json({ ok: true, service: "tychoiq", ts: new Date().toISOString() });
}
