import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { cookieSecure, sessionSecret } from "@/lib/env";

const ADMIN_COOKIE = "grokbott_admin";
const DASH_COOKIE = "grokbott_dash";

function secretKey() {
  return new TextEncoder().encode(sessionSecret());
}

export async function signAdminSession(operatorId: string, email: string) {
  return new SignJWT({ sub: operatorId, email, typ: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey());
}

export async function signDashboardSession(grokbotId: string, slug: string) {
  return new SignJWT({ sub: grokbotId, slug, typ: "dashboard" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("14d")
    .sign(secretKey());
}

export async function readAdminSession() {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (payload.typ !== "admin") return null;
    return { operatorId: String(payload.sub), email: String(payload.email) };
  } catch {
    return null;
  }
}

export async function readDashboardSession(slug: string) {
  const token = (await cookies()).get(DASH_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (payload.typ !== "dashboard") return null;
    if (String(payload.slug) !== slug) return null;
    return { grokbotId: String(payload.sub), slug: String(payload.slug) };
  } catch {
    return null;
  }
}

function cookieBase() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: cookieSecure(),
  };
}

export async function setAdminCookie(jwt: string) {
  (await cookies()).set(ADMIN_COOKIE, jwt, {
    ...cookieBase(),
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function setDashboardCookie(jwt: string) {
  (await cookies()).set(DASH_COOKIE, jwt, {
    ...cookieBase(),
    maxAge: 60 * 60 * 24 * 14,
  });
}

export async function clearAdminCookie() {
  (await cookies()).delete(ADMIN_COOKIE);
}

export async function requireAdmin() {
  const session = await readAdminSession();
  if (!session) {
    throw new Error("UNAUTHENTICATED");
  }
  return session;
}
