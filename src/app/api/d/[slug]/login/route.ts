import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { dashboards } from "@/lib/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { setDashboardCookie, signDashboardSession } from "@/lib/auth/session";
import { writeActionLog } from "@/lib/logs/write";
import { rateLimitFixed } from "@/lib/rate-limit";

const LOGIN_LIMIT = 12;
const WINDOW_MS = 15 * 60 * 1000;

export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local";
  const rlKey = `dash-login:${slug}:${ip}`;
  if (!rateLimitFixed(rlKey, LOGIN_LIMIT, WINDOW_MS)) {
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde alguns minutos." },
      { status: 429 },
    );
  }
  const { password } = (await req.json()) as { password?: string };
  const [dash] = await getDb()
    .select()
    .from(dashboards)
    .where(eq(dashboards.slug, slug))
    .limit(1);
  if (!dash || !password) {
    return NextResponse.json({ error: "Senha inválida." }, { status: 401 });
  }
  const ok = await verifyPassword(password, dash.passwordHash);
  if (!ok) {
    await writeActionLog({
      grokbotId: dash.grokbotId,
      kind: "dashboard_login_failed",
      payload: { slug, ip },
    });
    return NextResponse.json({ error: "Senha inválida." }, { status: 401 });
  }
  const jwt = await signDashboardSession(dash.grokbotId, dash.slug);
  await setDashboardCookie(jwt);
  await writeActionLog({
    grokbotId: dash.grokbotId,
    kind: "dashboard_login_ok",
    payload: { slug, ip },
  });
  return NextResponse.json({ ok: true });
}