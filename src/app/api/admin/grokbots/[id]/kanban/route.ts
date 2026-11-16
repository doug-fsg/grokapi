import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { grokbots, grokbotsSecrets } from "@/lib/db/schema";
import { adminGuard, fail } from "@/lib/admin/http";
import { createManytalksClient, unwrapList } from "@/lib/manytalks/client";
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
  const [secrets] = await db
    .select()
    .from(grokbotsSecrets)
    .where(eq(grokbotsSecrets.grokbotId, id))
    .limit(1);
  if (!bot) return fail("Não encontrado.", 404);
  const token = manytalksTokenFromEnc(secrets?.manytalksTokenEnc);
  if (!token) {
    return fail(
      "Token ManyTalks ausente. Configure MANYTALKS_SERVICE_TOKEN no .env ou cole um PAT no wizard.",
    );
  }
  try {
    const client = createManytalksClient({
      base: bot.manytalksBase,
      accountId: bot.manytalksAccountId,
      token,
    });
    const raw = await client.listPipelines();
    const list = unwrapList<Record<string, unknown>>(
      raw as { payload?: Record<string, unknown>[] } | Record<string, unknown>[],
    ).filter((p) => p.is_kanban === true);
    return NextResponse.json({ pipelines: list });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Falha ao listar pipelines.", 502);
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { error } = await adminGuard();
  if (error) return error;
  const { id } = await ctx.params;
  const body = (await req.json()) as {
    name: string;
    key?: string;
    stages: { name: string; color?: string }[];
  };
  const db = getDb();
  const [bot] = await db.select().from(grokbots).where(eq(grokbots.id, id)).limit(1);
  const [secrets] = await db
    .select()
    .from(grokbotsSecrets)
    .where(eq(grokbotsSecrets.grokbotId, id))
    .limit(1);
  if (!bot) return fail("Não encontrado.", 404);
  const token = manytalksTokenFromEnc(secrets?.manytalksTokenEnc);
  if (!token) {
    return fail(
      "Token ManyTalks ausente. Configure MANYTALKS_SERVICE_TOKEN no .env ou cole um PAT no wizard.",
    );
  }
  try {
    const client = createManytalksClient({
      base: bot.manytalksBase,
      accountId: bot.manytalksAccountId,
      token,
    });
    const created = await client.createPipeline({
      custom_attribute_definition: {
        attribute_display_name: body.name,
        attribute_key:
          body.key ??
          body.name
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/\s+/g, "_"),
        attribute_display_type: "list",
        attribute_model: "contact_attribute",
        is_kanban: true,
        attribute_values: {
          stages: body.stages.map((s) => ({
            name: s.name,
            color: s.color ?? "#6366f1",
          })),
          ownership_mode: "linked",
        },
      },
    });
    return NextResponse.json({ pipeline: created });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Falha.";
    const status = msg.includes("403") ? 403 : 502;
    return fail(
      status === 403
        ? "Kanban negou (403). Use token com permissão CRM / criar no ManyTalks."
        : msg,
      status,
    );
  }
}
