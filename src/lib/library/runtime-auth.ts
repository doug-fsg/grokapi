import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { grokbotsRuntimeTokens } from "@/lib/db/schema";
import { hashToken } from "@/lib/crypto";
import { runtimeTokenAllowed } from "@/lib/library/runtime-token-grace";

export async function resolveRuntimeToken(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token.startsWith("grk_live_")) return null;
  const hash = hashToken(token);
  const [row] = await getDb()
    .select()
    .from(grokbotsRuntimeTokens)
    .where(and(eq(grokbotsRuntimeTokens.tokenHash, hash), isNull(grokbotsRuntimeTokens.revokedAt)))
    .limit(1);
  if (!row) return null;
  if (row.expiresAt && new Date(row.expiresAt) < new Date()) return null;
  const ok = await runtimeTokenAllowed(row.grokbotId, row.id, row.createdAt);
  if (!ok) return null;
  return row;
}
