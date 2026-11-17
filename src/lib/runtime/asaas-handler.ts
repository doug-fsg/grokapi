import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { domainEvents, grokbots, paymentEvents } from "@/lib/db/schema";
import { loadPublishedManifest } from "@/lib/manifest/load-published";
import { createManytalksClient } from "@/lib/manytalks/client";
import { nowIso } from "@/lib/utils";

type Payload = Record<string, unknown>;

export async function handleAsaasWebhook(grokbotId: string, body: Payload) {
  const [bot] = await getDb()
    .select({ enabled: grokbots.enabled })
    .from(grokbots)
    .where(eq(grokbots.id, grokbotId))
    .limit(1);
  if (!bot) throw new Error("ManyTalks Bot não encontrado.");
  if (!bot.enabled) return { skipped: true, reason: "pausado (webhooks/API off)" };

  const manifest = await loadPublishedManifest(grokbotId);
  if (!manifest) return { skipped: true, reason: "manifesto não publicado" };
  const event = String(body.event ?? "");
  const payment = (body.payment ?? body) as Payload;
  const asaasEventId = String(body.id ?? `${event}-${payment.id ?? crypto.randomUUID()}`);
  const db = getDb();
  try {
    await db.insert(paymentEvents).values({
      id: crypto.randomUUID(),
      grokbotId,
      asaasEventId,
      eventType: event,
      paymentId: payment.id ? String(payment.id) : null,
      amount: payment.value != null ? String(payment.value) : null,
      status: payment.status ? String(payment.status) : null,
      conversationId: payment.externalReference ? String(payment.externalReference) : null,
      payloadJson: JSON.stringify(body),
      createdAt: nowIso(),
    });
  } catch {
    return { skipped: true, reason: "evento duplicado" };
  }
  await db.insert(domainEvents).values({
    id: crypto.randomUUID(),
    grokbotId,
    type: `asaas.${event || "event"}`,
    payloadJson: JSON.stringify({
      paymentId: payment.id,
      value: payment.value,
      status: payment.status,
    }),
    createdAt: nowIso(),
  });
  const paid =
    event.toUpperCase().includes("PAYMENT_CONFIRMED") ||
    event.toUpperCase().includes("PAYMENT_RECEIVED") ||
    String(payment.status).toUpperCase() === "RECEIVED" ||
    String(payment.status).toUpperCase() === "CONFIRMED";
  if (!paid) return { ok: true, event };
  const convId = String(
    payment.externalReference ?? nested(payment, "metadata", "conversation_id") ?? "",
  );
  const contactId = Number(nested(payment, "metadata", "contact_id") ?? 0);
  const client = createManytalksClient({
    base: manifest.manytalks.base_url,
    accountId: manifest.manytalks.account_id,
    token: manifest.manytalks.api_access_token,
  });
  const post = manifest.post_payment;
  if (post.crm_enabled && convId) {
    if (post.labels_on_paid.length) {
      const current = await client.getLabels(convId).catch(() => []);
      const list = Array.isArray(current)
        ? current.map(String)
        : ((current as { payload?: string[] })?.payload ?? []).map(String);
      const next = Array.from(new Set([...list, ...post.labels_on_paid])).sort();
      await client.setLabels(convId, next);
    }
    if (post.kanban_stage_on_paid && manifest.kanban.pipeline_id && contactId) {
      await client.moveKanban(contactId, manifest.kanban.pipeline_id, {
        stage_id: post.kanban_stage_on_paid,
        position: 0,
      });
    }
  }
  if (post.message_enabled && convId && post.message_template) {
    const nome = String(payment.customerName ?? payment.customer ?? "cliente");
    const valor = String(payment.value ?? "");
    const text = post.message_template
      .replaceAll("{{nome}}", nome)
      .replaceAll("{{valor}}", valor);
    await client.sendMessage(convId, text);
  }
  const { writeActionLog } = await import("@/lib/logs/write");
  await writeActionLog({
    grokbotId,
    conversationId: convId || null,
    kind: "asaas_payment_confirmed",
    payload: {
      event,
      paymentId: payment.id,
      amount: payment.value,
      crm: post.crm_enabled,
      message: post.message_enabled,
    },
  });
  return { ok: true, paid: true };
}

function nested(obj: Payload, ...keys: string[]) {
  let cur: unknown = obj;
  for (const k of keys) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Payload)[k];
  }
  return cur;
}
