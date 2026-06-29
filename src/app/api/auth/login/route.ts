import { z } from "zod";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fail, handleError } from "@/lib/api";
import { verifyPassword, signSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

const Schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = Schema.parse(await req.json());
    const user = await prisma.user.findUnique({ where: { email: body.email.trim().toLowerCase() } });
    if (!user || !verifyPassword(body.password, user.passwordHash)) {
      return fail("Invalid email or password.", 401);
    }
    const res = NextResponse.json({ ok: true, data: { id: user.id, email: user.email, name: user.name } });
    res.cookies.set(SESSION_COOKIE, signSession(user.id), sessionCookieOptions());
    return res;
  } catch (err) {
    return handleError(err);
  }
}
