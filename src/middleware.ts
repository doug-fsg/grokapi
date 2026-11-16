import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC = [
  "/login",
  "/api/auth/login",
  "/api/hooks",
  "/api/library",
  "/api/d",
];

function isPublic(pathname: string) {
  if (pathname.startsWith("/d/")) return true;
  return PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    isPublic(pathname)
  ) {
    return NextResponse.next();
  }
  if (pathname.startsWith("/api/admin") || !pathname.startsWith("/api")) {
    const token = req.cookies.get("grokbott_admin")?.value;
    if (!token) {
      if (pathname.startsWith("/api")) {
        return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/login", req.url));
    }
    try {
      await jwtVerify(token, new TextEncoder().encode(process.env.SESSION_SECRET ?? "dev-session-secret-change-me"));
    } catch {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
