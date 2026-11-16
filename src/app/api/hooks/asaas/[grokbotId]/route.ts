import { eq } from "drizzle-orm";
import { after } from "next/server";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { grokbots } from "@/lib/db/schema";
import { enqueueJob } from "@/lib/jobs/queue";
import { drainJobs } from "@/lib/jobs/process";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ grokbotId: string }> },
) {
  const { grokbotId } = await ctx.params;
  const [bot] = await getDb()
    .select({ enabled: grokbots.enabled })
    .from(grokbots)
    .where(eq(grokbots.id, grokbotId))
    .limit(1);
  if (!bot) return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  if (!bot.enabled) {
    return NextResponse.json({ ok: true, skipped: true, reason: "pausado" });
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  await enqueueJob("process_asaas_webhook", { grokbotId, body });
  await enqueueJob("aggregate_dashboard_daily", { grokbotId });
  after(async () => {
    await drainJobs(4);
  });
  return NextResponse.json({ ok: true });
}
