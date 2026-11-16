import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { grokbots, grokbotsManifestSnapshots, actionLogs } from "@/lib/db/schema";
import { adminGuard } from "@/lib/admin/http";

export async function GET() {
  const { error } = await adminGuard();
  if (error) return error;
  const db = getDb();
  const bots = await db.select().from(grokbots);
  const snaps = await db
    .select()
    .from(grokbotsManifestSnapshots)
    .orderBy(desc(grokbotsManifestSnapshots.publishedAt));
  const logs = await db.select().from(actionLogs).orderBy(desc(actionLogs.createdAt));
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const errors24h = bots.filter(
    (b) => b.lastError && b.updatedAt && new Date(b.updatedAt).getTime() > dayAgo,
  );
  return NextResponse.json({
    grokbots: bots,
    errors24h,
    publications: snaps.slice(0, 8),
    recentLogs: logs.slice(0, 12),
  });
}
