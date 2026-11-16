import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { grokbots, grokbotsSecrets } from "@/lib/db/schema";
import { adminGuard, fail } from "@/lib/admin/http";
import { createManytalksClient, unwrapList } from "@/lib/manytalks/client";
import { manytalksTokenFromEnc } from "@/lib/manytalks/token";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { error } = await adminGuard();
  if (error) return error;
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { token?: string };
  const db = getDb();
  const [bot] = await db.select().from(grokbots).where(eq(grokbots.id, id)).limit(1);
  if (!bot) return fail("Não encontrado.", 404);
  const [secrets] = await db
    .select()
    .from(grokbotsSecrets)
    .where(eq(grokbotsSecrets.grokbotId, id))
    .limit(1);
  const token =
    (body.token ?? "").trim() || manytalksTokenFromEnc(secrets?.manytalksTokenEnc);
  if (!token) {
    return fail(
      "Informe o PAT ou configure MANYTALKS_SERVICE_TOKEN no .env.",
    );
  }
  try {
    const client = createManytalksClient({
      base: bot.manytalksBase,
      accountId: bot.manytalksAccountId,
      token,
    });
    const inboxesRaw = await client.listInboxes();
    const inboxes = unwrapList<Record<string, unknown>>(
      inboxesRaw as { payload?: Record<string, unknown>[] } | Record<string, unknown>[],
    ).map((i) => ({
      id: Number(i.id),
      name: String(i.name ?? i.id),
    }));
    return NextResponse.json({ ok: true, inboxes });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Falha ManyTalks.", 502);
  }
}
