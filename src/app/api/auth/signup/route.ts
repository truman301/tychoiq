import { z } from "zod";
import { NextResponse } from "next/server";
import { fail, handleError } from "@/lib/api";
import { env } from "@/lib/env";
import { createUserWithWorkspace, signSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

const Schema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    if (env.disableSignup) return fail("Sign-up is disabled on this instance.", 403);
    const body = Schema.parse(await req.json());
    const user = await createUserWithWorkspace(body);

    const res = NextResponse.json({ ok: true, data: { id: user.id, email: user.email, name: user.name } }, { status: 201 });
    res.cookies.set(SESSION_COOKIE, signSession(user.id), sessionCookieOptions());
    return res;
  } catch (err) {
    return handleError(err);
  }
}
