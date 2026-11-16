import { after } from "next/server";
import { NextResponse } from "next/server";
import { enqueueJob } from "@/lib/jobs/queue";
import { drainJobs } from "@/lib/jobs/process";
import { extractAccountId, resolveGrokbotByAccount } from "@/lib/runtime/manytalks-handler";
import { extractInboxId, loadBotGate, shouldProcessInbox } from "@/lib/runtime/inbox-filter";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const accountId = extractAccountId(body);
  const bot = accountId ? await resolveGrokbotByAccount(accountId) : null;

  // Filtra cedo: account sem bot, pausado, ou inbox fora da lista → 204 sem job/Grok.
  if (bot) {
    const gate = await loadBotGate(bot.id);
    if (!gate?.enabled) {
      return new NextResponse(null, { status: 204 });
    }
    const inboxId = extractInboxId(body);
    // Filtra por inbox quando o payload traz inbox_id (message_created etc.).
    if (inboxId != null) {
      const inboxOk = shouldProcessInbox(inboxId, gate.inboxIds);
      if (inboxOk !== true) {
        return new NextResponse(null, { status: 204 });
      }
    }
  }

  await enqueueJob("process_manytalks_webhook", {
    ...body,
    grokbotId: bot?.id,
  });
  after(async () => {
    await drainJobs(4);
  });
  return new NextResponse(null, { status: 204 });
}
