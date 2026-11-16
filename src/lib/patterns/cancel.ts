import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { jobs, patternScans } from "@/lib/db/schema";
import { jsonParse, nowIso } from "@/lib/utils";

const ACTIVE = ["pending", "running"] as const;

export async function isScanCancelled(scanId: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ status: patternScans.status })
    .from(patternScans)
    .where(eq(patternScans.id, scanId))
    .limit(1);
  return row?.status === "cancelled";
}

export async function assertScanActive(scanId: string) {
  if (await isScanCancelled(scanId)) {
    const err = new Error("CANCELLED");
    err.name = "ScanCancelled";
    throw err;
  }
}

export function isCancelError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === "ScanCancelled" || err.message === "CANCELLED")
  );
}

/** Cancela scans ativos do bot (ou um scanId). Também marca jobs relacionados. */
export async function cancelPatternScans(opts: {
  grokbotId: string;
  scanId?: string;
  reason?: string;
}) {
  const db = getDb();
  const reason = (opts.reason ?? "Cancelado pelo operador").slice(0, 500);

  const active = await db
    .select({ id: patternScans.id, status: patternScans.status })
    .from(patternScans)
    .where(
      and(
        eq(patternScans.grokbotId, opts.grokbotId),
        opts.scanId
          ? eq(patternScans.id, opts.scanId)
          : inArray(patternScans.status, [...ACTIVE]),
      ),
    );

  const toCancel = active.filter((s) =>
    opts.scanId
      ? s.id === opts.scanId && ACTIVE.includes(s.status as (typeof ACTIVE)[number])
      : ACTIVE.includes(s.status as (typeof ACTIVE)[number]),
  );

  for (const scan of toCancel) {
    await db
      .update(patternScans)
      .set({ status: "cancelled", error: reason })
      .where(eq(patternScans.id, scan.id));
  }

  const jobRows = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.type, "scan_win_patterns"), inArray(jobs.status, [...ACTIVE])));

  let jobsCancelled = 0;
  for (const job of jobRows) {
    const payload = jsonParse<Record<string, unknown>>(job.payloadJson, {});
    if (String(payload.grokbotId ?? "") !== opts.grokbotId) continue;
    const jobScanId = String(payload.scanId ?? "");
    if (opts.scanId && jobScanId !== opts.scanId) continue;
    await db
      .update(jobs)
      .set({ status: "cancelled", lastError: reason })
      .where(eq(jobs.id, job.id));
    jobsCancelled += 1;
  }

  return {
    cancelledScans: toCancel.length,
    cancelledJobs: jobsCancelled,
    at: nowIso(),
  };
}

/**
 * Jobs `running` há tempo demais (ou scan já cancelado) → cancelled.
 * Cascade LLM tem teto ~3 min; margem larga só para órfãos (worker morto).
 */
export async function recoverStuckScanJobs(maxAgeMs = 8 * 60 * 1000) {
  const db = getDb();
  const cutoff = new Date(Date.now() - maxAgeMs).toISOString();
  const stuck = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.type, "scan_win_patterns"), eq(jobs.status, "running")));

  let n = 0;
  for (const job of stuck) {
    const payload = jsonParse<Record<string, unknown>>(job.payloadJson, {});
    const scanId = String(payload.scanId ?? "");
    const tooOld = job.createdAt <= cutoff;
    const scanCancelled = scanId ? await isScanCancelled(scanId) : false;
    if (!tooOld && !scanCancelled) continue;

    await db
      .update(jobs)
      .set({
        status: "cancelled",
        lastError: scanCancelled
          ? "Cancelado pelo operador"
          : "Cancelado: job travado (timeout)",
      })
      .where(eq(jobs.id, job.id));

    if (scanId && !scanCancelled) {
      await db
        .update(patternScans)
        .set({
          status: "cancelled",
          error: "Cancelado: análise travada (timeout)",
        })
        .where(
          and(eq(patternScans.id, scanId), inArray(patternScans.status, [...ACTIVE])),
        );
    }
    n += 1;
  }
  return n;
}
