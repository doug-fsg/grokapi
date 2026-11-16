import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { adminGuard, fail } from "@/lib/admin/http";
import { upsertDashboard } from "@/lib/admin/grokbot-service";
import { decryptSecret } from "@/lib/crypto";
import { getDb } from "@/lib/db";
import { dashboards } from "@/lib/db/schema";
import { appUrl } from "@/lib/utils";

const schema = z.object({
  password: z.string().min(6),
  slug: z.string().optional(),
});

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { error } = await adminGuard();
  if (error) return error;
  const { id } = await ctx.params;
  const [dash] = await getDb()
    .select()
    .from(dashboards)
    .where(eq(dashboards.grokbotId, id))
    .limit(1);
  if (!dash) return fail("Dashboard ainda não existe.", 404);
  const reveal = new URL(req.url).searchParams.get("reveal") === "1";
  let password: string | null = null;
  if (reveal && dash.passwordEnc) {
    password = decryptSecret(dash.passwordEnc);
  }
  return NextResponse.json({
    slug: dash.slug,
    url: `${appUrl()}/d/${dash.slug}`,
    recoverable: Boolean(dash.passwordEnc),
    password,
  });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { error } = await adminGuard();
  if (error) return error;
  const { id } = await ctx.params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return fail("Senha do dashboard deve ter no mínimo 6 caracteres.");
  const slug = await upsertDashboard(id, parsed.data.password, parsed.data.slug);
  return NextResponse.json({
    slug,
    url: `${appUrl()}/d/${slug}`,
    recoverable: true,
    password: parsed.data.password,
  });
}
