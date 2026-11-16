import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  conversationStates,
  domainEvents,
  grokbots,
  processedMessages,
} from "@/lib/db/schema";
import { compileManifest } from "@/lib/manifest/compile";
import { writeActionLog } from "@/lib/logs/write";
import { extractInboxId, loadBotGate, shouldProcessInbox } from "@/lib/runtime/inbox-filter";
import { digestMessageWebhook } from "@/lib/runtime/turn-context";
import {
  forwardToOutboundWebhook,
  getOutboundWebhook,
  type OutboundEnvelope,
} from "@/lib/runtime/outbound-forward";
import { nowIso } from "@/lib/utils";
import type { ManifestV1 } from "@/lib/types/manifest";

type Payload = Record<string, unknown>;

function nested(obj: Payload, ...keys: string[]) {
  let cur: unknown = obj;
  for (const k of keys) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Payload)[k];
  }
  return cur;
}

export function extractAccountId(body: Payload) {
  const id =
    nested(body, "account", "id") ??
    body.account_id ??
    nested(body, "conversation", "account_id");
  return Number(id);
}

export async function resolveGrokbotByAccount(accountId: number) {
  const [bot] = await getDb()
    .select()
    .from(grokbots)
    .where(eq(grokbots.manytalksAccountId, accountId))
    .limit(1);
  return bot ?? null;
}

export async function handleManytalksWebhook(body: Payload) {
  const event = String(body.event ?? body.event_type ?? "");
  const accountId = extractAccountId(body);
  if (!accountId) return { skipped: true, reason: "sem account_id" };
  const bot = await resolveGrokbotByAccount(accountId);
  if (!bot) return { skipped: true, reason: "grokbot não encontrado" };

  const gate = await loadBotGate(bot.id);
  if (!gate) return { skipped: true, reason: "grokbot não encontrado" };
  if (!gate.enabled) {
    return { skipped: true, reason: "pausado (webhooks/API off)" };
  }

  const inboxId = extractInboxId(body);
  const inboxOk = shouldProcessInbox(inboxId, gate.inboxIds);
  if (inboxOk !== true) {
    return { skipped: true, reason: inboxOk };
  }

  const manifest = await compileManifest(bot.id, { includeSecrets: true });
  if (!manifest) return { skipped: true, reason: "sem manifest" };

  if (event === "contact_kanban_stage_changed") {
    return handleKanbanPause(manifest, body);
  }
  if (event && event !== "message_created") {
    return { skipped: true, reason: `evento ${event}` };
  }
  return handleMessageCreated(manifest, body, inboxId!);
}

async function handleKanbanPause(manifest: ManifestV1, body: Payload) {
  const stage = String(
    nested(body, "pipeline_position", "stage_id") ?? "",
  );
  const convId = String(
    nested(body, "pipeline_position", "metadata", "primary_conversation_id") ??
      nested(body, "conversation", "id") ??
      "",
  );
  if (stage && manifest.kanban.pause_bot_stages.includes(stage) && convId) {
    await upsertPause(manifest.grokbot.id, convId, "kanban_webhook");
  }
  return { ok: true, event: "contact_kanban_stage_changed" };
}

async function handleMessageCreated(
  manifest: ManifestV1,
  body: Payload,
  inboxId: number,
) {
  const digest = digestMessageWebhook(body);
  const message = (body.message ?? nested(body, "payload") ?? body) as Payload;
  const incoming = digest.from === "client";
  if (manifest.conversation_rules.only_incoming && !incoming) {
    return { skipped: true, reason: "não incoming" };
  }
  if (manifest.conversation_rules.ignore_private && message.private) {
    return { skipped: true, reason: "privada" };
  }
  const conversationId = digest.conversation_id;
  const messageId = digest.message_id;
  if (!conversationId || !messageId) return { skipped: true, reason: "ids ausentes" };

  const db = getDb();
  try {
    await db.insert(processedMessages).values({
      id: crypto.randomUUID(),
      grokbotId: manifest.grokbot.id,
      messageId,
      conversationId,
      processedAt: nowIso(),
    });
  } catch {
    return { skipped: true, reason: "idempotente" };
  }

  const [state] = await db
    .select()
    .from(conversationStates)
    .where(
      and(
        eq(conversationStates.grokbotId, manifest.grokbot.id),
        eq(conversationStates.conversationId, conversationId),
      ),
    )
    .limit(1);
  if (state?.botPaused) return { skipped: true, reason: "bot pausado" };

  const outbound = await getOutboundWebhook(manifest.grokbot.id);
  if (!outbound) {
    const msg =
      "Webhook de saída não configurado. O runtime externo deve PUT /api/library/v1/outbound-webhook.";
    await writeActionLog({
      grokbotId: manifest.grokbot.id,
      conversationId,
      kind: "skip:no_outbound_webhook",
      payload: { inbox_id: inboxId, message_id: messageId },
    });
    await db
      .update(grokbots)
      .set({ lastError: msg, updatedAt: nowIso() })
      .where(eq(grokbots.id, manifest.grokbot.id));
    return { skipped: true, reason: "sem webhook de saída" };
  }

  const conversation = (body.conversation ?? nested(message, "conversation") ?? {}) as Payload;
  const sender = (nested(message, "sender") ??
    nested(body, "sender") ??
    nested(conversation, "meta", "sender") ??
    {}) as Payload;
  const contactIdRaw = sender.id != null ? Number(sender.id) : NaN;
  const labelsFromBody = Array.isArray(conversation.labels)
    ? (conversation.labels as unknown[]).map(String)
    : [];
  const status = String(conversation.status ?? "open");
  if (!manifest.conversation_rules.statuses.includes(status)) {
    return { skipped: true, reason: `status ${status}` };
  }
  const envelope: OutboundEnvelope = {
    schema_version: "1.0",
    event: "message_created",
    grokbot_id: manifest.grokbot.id,
    manytalks: {
      account_id: manifest.manytalks.account_id,
      conversation_id: conversationId,
      inbox_id: inboxId,
      contact_id: Number.isFinite(contactIdRaw) ? contactIdRaw : null,
      contact_name: sender.name != null ? String(sender.name) : null,
      status,
      message_id: messageId,
      from: digest.from,
      content: digest.content || String(message.content ?? "").trim(),
    },
    labels: labelsFromBody,
    received_at: nowIso(),
  };
  const fwd = await forwardToOutboundWebhook({
      grokbotId: manifest.grokbot.id,
      url: outbound.url,
      authHeader: outbound.authHeader,
      authValue: outbound.authValue,
      envelope,
    });
  await db.insert(domainEvents).values({
    id: crypto.randomUUID(),
    grokbotId: manifest.grokbot.id,
    type: "message_forwarded",
    payloadJson: JSON.stringify({
      conversationId,
      ok: fwd.ok,
      status: fwd.status,
    }),
    createdAt: nowIso(),
  });
  await db
    .update(grokbots)
    .set({
      lastHealthAt: nowIso(),
      lastError: fwd.ok
        ? null
        : fwd.error
          ? `forward outbound: ${fwd.error}`
          : `forward outbound HTTP ${fwd.status}`,
      updatedAt: nowIso(),
    })
    .where(eq(grokbots.id, manifest.grokbot.id));
  return { ok: fwd.ok, forwarded: true, status: fwd.status };
}

async function upsertPause(grokbotId: string, conversationId: string, reason: string) {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(conversationStates)
    .where(
      and(
        eq(conversationStates.grokbotId, grokbotId),
        eq(conversationStates.conversationId, conversationId),
      ),
    )
    .limit(1);
  if (existing) {
    await db
      .update(conversationStates)
      .set({ botPaused: true, pauseReason: reason, updatedAt: nowIso() })
      .where(
        and(
          eq(conversationStates.grokbotId, grokbotId),
          eq(conversationStates.conversationId, conversationId),
        ),
      );
    return;
  }
  await db.insert(conversationStates).values({
    grokbotId,
    conversationId,
    botPaused: true,
    pauseReason: reason,
    updatedAt: nowIso(),
  });
}

export async function recordBotError(grokbotId: string, error: string) {
  await getDb()
    .update(grokbots)
    .set({ lastError: error, updatedAt: nowIso() })
    .where(eq(grokbots.id, grokbotId));
}
