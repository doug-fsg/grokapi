import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { grokbotsRuntimeTokens } from "@/lib/db/schema";
import { nowIso } from "@/lib/utils";

const GRACE_MS = 24 * 60 * 60 * 1000;

/** Mantém os 2 tokens ativos mais recentes; demais revogados após 24h. */
export async function pruneRuntimeTokens(grokbotId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(grokbotsRuntimeTokens)
    .where(
      and(eq(grokbotsRuntimeTokens.grokbotId, grokbotId), isNull(grokbotsRuntimeTokens.revokedAt)),
    )
    .orderBy(desc(grokbotsRuntimeTokens.createdAt));
  const now = Date.now();
  const ts = nowIso();
  for (let i = 2; i < rows.length; i++) {
    const created = new Date(rows[i].createdAt).getTime();
    if (now - created > GRACE_MS) {
      await db
        .update(grokbotsRuntimeTokens)
        .set({ revokedAt: ts })
        .where(eq(grokbotsRuntimeTokens.id, rows[i].id));
    }
  }
}

export async function runtimeTokenAllowed(
  grokbotId: string,
  tokenId: string,
  createdAt: string,
): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .select({ id: grokbotsRuntimeTokens.id, createdAt: grokbotsRuntimeTokens.createdAt })
    .from(grokbotsRuntimeTokens)
    .where(
      and(eq(grokbotsRuntimeTokens.grokbotId, grokbotId), isNull(grokbotsRuntimeTokens.revokedAt)),
    )
    .orderBy(desc(grokbotsRuntimeTokens.createdAt));
  const idx = rows.findIndex((r) => r.id === tokenId);
  if (idx < 0) return false;
  if (idx < 2) return true;
  return Date.now() - new Date(createdAt).getTime() <= GRACE_MS;
}