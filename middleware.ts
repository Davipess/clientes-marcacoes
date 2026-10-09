import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const IS_PROD = process.env.NODE_ENV === "production";
const SESSION_COOKIE = IS_PROD ? "__Host-sessao" : "sessao";

// Paths that require authentication.
const ADMIN_API = "/api/admin/";
const ADMIN_PAGE = "/admin";
const STAFF_API = "/api/staff/";
const STAFF_PAGE = "/staff";

function isProtectedPath(pathname: string): boolean {
  return (
    pathname.startsWith(ADMIN_API) ||
    pathname.startsWith(ADMIN_PAGE) ||
    pathname.startsWith(STAFF_API) ||
    pathname.startsWith(STAFF_PAGE)
  );
}

function isApiPath(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isProtectedPath(pathname)) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;

  // No session cookie at all → block immediately.
  // Real session verification still happens in getAuthUser() inside route handlers.
  if (!token) {
    if (isApiPath(pathname)) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    const loginUrl = new URL("/entrar", request.url);
    loginUrl.searchParams.set("de", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Token format sanity check (base64url, ~43 chars for 32 bytes).
  // Catches obviously forged/empty cookies. Not a security boundary ,
  // getAuthUser() does the real DB lookup.
  if (token.length < 20 || /[^a-zA-Z0-9_-]/.test(token)) {
    if (isApiPath(pathname)) {
      return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });
    }
    const loginUrl = new URL("/entrar", request.url);
    loginUrl.searchParams.set("de", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/staff/:path*", "/api/staff/:path*"],
};
