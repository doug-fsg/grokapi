import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { grokbots, grokbotsSecrets } from "@/lib/db/schema";
import { adminGuard, fail } from "@/lib/admin/http";
import { createManytalksClient } from "@/lib/manytalks/client";
import { unwrapLabelTitles } from "@/lib/manytalks/labels";
import { manytalksTokenFromEnc } from "@/lib/manytalks/token";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { error } = await adminGuard();
  if (error) return error;
  const { id } = await ctx.params;
  const db = getDb();
  const [bot] = await db.select().from(grokbots).where(eq(grokbots.id, id)).limit(1);
  if (!bot) return fail("Não encontrado.", 404);

  const [secrets] = await db
    .select()
    .from(grokbotsSecrets)
    .where(eq(grokbotsSecrets.grokbotId, id))
    .limit(1);
  const token = manytalksTokenFromEnc(secrets?.manytalksTokenEnc);
  if (!token) {
    return fail(
      "Token ManyTalks ausente. Configure MANYTALKS_SERVICE_TOKEN no .env.",
      400,
    );
  }

  try {
    const client = createManytalksClient({
      base: bot.manytalksBase,
      accountId: bot.manytalksAccountId,
      token,
    });
    const labels = unwrapLabelTitles(await client.listAccountLabels());
    return NextResponse.json({
      labels,
      accountId: bot.manytalksAccountId,
    });
  } catch (err) {
    return fail(
      err instanceof Error ? err.message : "Falha ao listar etiquetas no ManyTalks.",
      502,
    );
  }
}
