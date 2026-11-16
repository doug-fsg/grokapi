import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { dashboardDailyStats, domainEvents, paymentEvents } from "@/lib/db/schema";
import { jsonParse } from "@/lib/utils";

export async function dashboardKpis(grokbotId: string) {
  const db = getDb();
  const events = await db
    .select()
    .from(domainEvents)
    .where(eq(domainEvents.grokbotId, grokbotId));
  const payments = await db
    .select()
    .from(paymentEvents)
    .where(eq(paymentEvents.grokbotId, grokbotId));
  const daily = await db
    .select()
    .from(dashboardDailyStats)
    .where(eq(dashboardDailyStats.grokbotId, grokbotId));
  const paid = payments.filter((p) =>
    String(p.status ?? "").toUpperCase().match(/RECEIVED|CONFIRMED|PAID/),
  );
  const handled = events.filter((e) => e.type === "message_handled").length;
  const paidAmount = paid.reduce((s, p) => s + Number(p.amount ?? 0), 0);
  return {
    messagesHandled: handled,
    chargesCreated: events.filter((e) => e.type.startsWith("asaas.")).length + payments.length,
    paymentsCount: payments.length,
    paidCount: paid.length,
    paidAmount,
    ticketMedio: paid.length ? paidAmount / paid.length : 0,
    recentEvents: events.slice(-20).reverse(),
    payments: payments.slice(-20).reverse(),
    daily: daily.map((d) => ({ day: d.day, ...jsonParse(d.statsJson, {}) })),
  };
}
