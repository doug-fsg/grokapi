import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { dashboards } from "@/lib/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { setDashboardCookie, signDashboardSession } from "@/lib/auth/session";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
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
    return NextResponse.json({ error: "Senha inválida." }, { status: 401 });
  }
  const jwt = await signDashboardSession(dash.grokbotId, dash.slug);
  await setDashboardCookie(jwt);
  return NextResponse.json({ ok: true });
}
