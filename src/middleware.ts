import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/authConstants";

// Gate the whole app behind login. This is a lightweight presence check (the
// session signature is verified server-side on every data access via
// lib/access.ts). Edge runtime can't run node:crypto, so we don't verify here.

const PUBLIC_PATHS = ["/login", "/signup"];
const PUBLIC_API_PREFIX = "/api/auth/";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // API routes self-enforce auth (returning JSON 401/403 via lib/access.ts), so
  // never redirect them to the HTML login page.
  if (pathname.startsWith("/api/")) return NextResponse.next();

  // allow auth endpoints + auth pages
  if (pathname.startsWith(PUBLIC_API_PREFIX)) return NextResponse.next();
  const isPublicPage = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value);

  if (!hasSession && !isPublicPage) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // logged-in users shouldn't see login/signup
  if (hasSession && isPublicPage) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // run on everything except Next internals + static assets
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:png|jpg|jpeg|svg|ico|css|js)$).*)"],
};
