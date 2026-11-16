import { and, desc, eq, like } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { actionLogs, grokbots } from "@/lib/db/schema";
import { adminGuard, fail } from "@/lib/admin/http";

export async function GET(req: Request) {
  const { error } = await adminGuard();
  if (error) return error;

  const url = new URL(req.url);
  const grokbotId = url.searchParams.get("grokbotId")?.trim() || "";
  const kind = url.searchParams.get("kind")?.trim() || "";
  const q = url.searchParams.get("q")?.trim() || "";
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 100) || 100, 300);

  const db = getDb();
  const conditions = [];
  if (grokbotId) conditions.push(eq(actionLogs.grokbotId, grokbotId));
  if (kind) {
    if (kind === "tools") conditions.push(like(actionLogs.kind, "tool%"));
    else if (kind === "errors") conditions.push(like(actionLogs.kind, "%error%"));
    else conditions.push(eq(actionLogs.kind, kind));
  }
  if (q) {
    const safe = q.replace(/[%_]/g, "");
    if (safe) conditions.push(like(actionLogs.payloadRedacted, `%${safe}%`));
  }

  const where = conditions.length ? and(...conditions) : undefined;
  const rows = await db
    .select({
      id: actionLogs.id,
      grokbotId: actionLogs.grokbotId,
      conversationId: actionLogs.conversationId,
      kind: actionLogs.kind,
      payloadRedacted: actionLogs.payloadRedacted,
      createdAt: actionLogs.createdAt,
      botName: grokbots.name,
      accountId: grokbots.manytalksAccountId,
    })
    .from(actionLogs)
    .leftJoin(grokbots, eq(actionLogs.grokbotId, grokbots.id))
    .where(where)
    .orderBy(desc(actionLogs.createdAt))
    .limit(limit);

  const bots = await db
    .select({
      id: grokbots.id,
      name: grokbots.name,
      manytalksAccountId: grokbots.manytalksAccountId,
    })
    .from(grokbots);

  return NextResponse.json({ logs: rows, bots, limit });
}

export async function DELETE(req: Request) {
  const { error } = await adminGuard();
  if (error) return error;
  const url = new URL(req.url);
  const grokbotId = url.searchParams.get("grokbotId")?.trim();
  if (!grokbotId) return fail("Informe grokbotId para limpar logs.", 400);
  const db = getDb();
  await db.delete(actionLogs).where(eq(actionLogs.grokbotId, grokbotId));
  return NextResponse.json({ ok: true });
}
