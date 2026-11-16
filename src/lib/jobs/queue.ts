import { and, eq, lte } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { jobs } from "@/lib/db/schema";
import { nowIso } from "@/lib/utils";

export async function enqueueJob(type: string, payload: unknown, runAt = nowIso()) {
  const db = getDb();
  const id = crypto.randomUUID();
  await db.insert(jobs).values({
    id,
    type,
    payloadJson: JSON.stringify(payload),
    status: "pending",
    runAt,
    attempts: 0,
    createdAt: nowIso(),
  });
  return id;
}

export async function claimPendingJobs(limit = 5) {
  const db = getDb();
  const pending = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.status, "pending"), lte(jobs.runAt, nowIso())));
  const slice = pending.slice(0, limit);
  const claimed = [];
  for (const job of slice) {
    await db
      .update(jobs)
      .set({ status: "running", attempts: job.attempts + 1 })
      .where(eq(jobs.id, job.id));
    claimed.push({ ...job, attempts: job.attempts + 1, status: "running" });
  }
  return claimed;
}

export async function completeJob(id: string) {
  await getDb().update(jobs).set({ status: "done" }).where(eq(jobs.id, id));
}

export async function failJob(id: string, error: string, retry = true) {
  const db = getDb();
  const [job] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
  if (retry && (job?.attempts ?? 0) < 5) {
    const delay = Math.min(60, 2 ** (job?.attempts ?? 1)) * 1000;
    const runAt = new Date(Date.now() + delay).toISOString();
    await db
      .update(jobs)
      .set({ status: "pending", lastError: error, runAt })
      .where(eq(jobs.id, id));
    return;
  }
  await db
    .update(jobs)
    .set({ status: "failed", lastError: error })
    .where(eq(jobs.id, id));
}
