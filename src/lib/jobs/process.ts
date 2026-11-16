import { and, eq, gte } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  dashboardDailyStats,
  domainEvents,
  grokbots,
  jobs,
  paymentEvents,
} from "@/lib/db/schema";
import { handleManytalksWebhook, recordBotError } from "@/lib/runtime/manytalks-handler";
import { handleAsaasWebhook } from "@/lib/runtime/asaas-handler";
import { jsonParse, nowIso } from "@/lib/utils";
import { claimPendingJobs, completeJob, failJob } from "./queue";

export async function processJob(job: {
  id: string;
  type: string;
  payloadJson: string;
}) {
  const payload = jsonParse<Record<string, unknown>>(job.payloadJson, {});
  try {
    if (job.type === "process_manytalks_webhook") {
      await handleManytalksWebhook(payload);
    } else if (job.type === "process_asaas_webhook") {
      await handleAsaasWebhook(String(payload.grokbotId), payload.body as Record<string, unknown>);
    } else if (job.type === "aggregate_dashboard_daily") {
      const grokbotId = String(payload.grokbotId ?? "");
      if (grokbotId === "*") {
        const bots = await getDb().select({ id: grokbots.id }).from(grokbots);
        for (const bot of bots) await aggregateDashboard(bot.id);
      } else if (grokbotId) {
        await aggregateDashboard(grokbotId);
      }
    } else if (job.type === "scan_win_patterns") {
      const grokbotId = String(payload.grokbotId ?? "");
      const scanId = String(payload.scanId ?? "");
      if (!grokbotId || !scanId) throw new Error("scan_win_patterns exige grokbotId e scanId");
      const { isCancelError, isScanCancelled } = await import("@/lib/patterns/cancel");
      if (await isScanCancelled(scanId)) {
        await getDb()
          .update(jobs)
          .set({ status: "cancelled", lastError: "Cancelado pelo operador" })
          .where(eq(jobs.id, job.id));
        return;
      }
      const { runPatternScan, markPatternScanFailed } = await import("@/lib/patterns/scan");
      try {
        console.log(
          `[pattern-scan] job start scanId=${scanId.slice(0, 8)}… grokbot=${grokbotId.slice(0, 8)}…`,
        );
        await runPatternScan(grokbotId, scanId, payload.filters);
        console.log(`[pattern-scan] job OK scanId=${scanId.slice(0, 8)}…`);
      } catch (scanErr) {
        if (isCancelError(scanErr) || (await isScanCancelled(scanId))) {
          console.log(`[pattern-scan] job cancelado scanId=${scanId.slice(0, 8)}…`);
          await getDb()
            .update(jobs)
            .set({ status: "cancelled", lastError: "Cancelado pelo operador" })
            .where(eq(jobs.id, job.id));
          return;
        }
        const msg = scanErr instanceof Error ? scanErr.message : String(scanErr);
        console.error(`[pattern-scan] job FAIL scanId=${scanId.slice(0, 8)}…`, msg);
        await markPatternScanFailed(scanId, msg);
        const { writeActionLog } = await import("@/lib/logs/write");
        await writeActionLog({
          grokbotId,
          kind: "playbook_scan_error",
          payload: { scanId, error: msg, filters: payload.filters ?? null },
        });
        throw scanErr;
      }
    } else {
      throw new Error(`job_type desconhecido: ${job.type}`);
    }
    await completeJob(job.id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (payload.grokbotId && job.type !== "scan_win_patterns") {
      await recordBotError(String(payload.grokbotId), msg);
    }
    await failJob(job.id, msg);
  }
}

export async function drainJobs(limit = 8) {
  const { recoverStuckScanJobs } = await import("@/lib/patterns/cancel");
  await recoverStuckScanJobs();
  const claimed = await claimPendingJobs(limit);
  // Scans longos um a um: evita marcar vários como running e travar a fila.
  const scans = claimed.filter((j) => j.type === "scan_win_patterns");
  const others = claimed.filter((j) => j.type !== "scan_win_patterns");
  for (const job of others) {
    await processJob(job);
  }
  if (scans[0]) {
    await processJob(scans[0]);
    for (const extra of scans.slice(1)) {
      await getDb().update(jobs).set({ status: "pending" }).where(eq(jobs.id, extra.id));
    }
  }
  return claimed.length;
}

async function aggregateDashboard(grokbotId: string) {
  const db = getDb();
  const day = new Date().toISOString().slice(0, 10);
  const start = `${day}T00:00:00.000Z`;
  const events = await db
    .select()
    .from(domainEvents)
    .where(and(eq(domainEvents.grokbotId, grokbotId), gte(domainEvents.createdAt, start)));
  const payments = await db
    .select()
    .from(paymentEvents)
    .where(eq(paymentEvents.grokbotId, grokbotId));
  const paid = payments.filter((p) =>
    String(p.status ?? "").toUpperCase().match(/RECEIVED|CONFIRMED|PAID/),
  );
  const stats = {
    events: events.length,
    payments: payments.length,
    paid: paid.length,
    paidAmount: paid.reduce((s, p) => s + Number(p.amount ?? 0), 0),
  };
  const [existing] = await db
    .select()
    .from(dashboardDailyStats)
    .where(
      and(eq(dashboardDailyStats.grokbotId, grokbotId), eq(dashboardDailyStats.day, day)),
    )
    .limit(1);
  if (existing) {
    await db
      .update(dashboardDailyStats)
      .set({ statsJson: JSON.stringify(stats) })
      .where(eq(dashboardDailyStats.id, existing.id));
    return;
  }
  await db.insert(dashboardDailyStats).values({
    id: crypto.randomUUID(),
    grokbotId,
    day,
    statsJson: JSON.stringify(stats),
  });
  void nowIso;
}
