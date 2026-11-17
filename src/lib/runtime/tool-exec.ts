import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { conversationStates } from "@/lib/db/schema";
import {
  buildCreateContactBody,
  contactIdFromResponse,
  pickContactPatch,
} from "@/lib/manytalks/contacts";
import { createManytalksClient, unwrapList } from "@/lib/manytalks/client";
import {
  assignConversationToAgent,
  runStartConversation,
} from "@/lib/manytalks/conversation-lifecycle";
import { createAsaasClient, createPixWithCustomer } from "@/lib/asaas/client";
import { searchKnowledge } from "@/lib/knowledge/entries";
import {
  ManytalksSendErrorException,
  parseManytalksSendError,
} from "@/lib/manytalks/send-errors";
import { emitDomainEvent } from "@/lib/runtime/domain-events";
import type { ManifestV1 } from "@/lib/types/manifest";
import { nowIso } from "@/lib/utils";

function mt(manifest: ManifestV1) {
  return createManytalksClient({
    base: manifest.manytalks.base_url,
    accountId: manifest.manytalks.account_id,
    token: manifest.manytalks.api_access_token,
  });
}

export async function executeTool(
  manifest: ManifestV1,
  ctx: { conversationId: string | number; contactId?: number },
  name: string,
  args: Record<string, unknown>,
) {
  const client = mt(manifest);
  if (name === "delete_contact") {
    throw new Error("Excluir contato é proibido neste ManyTalks Bot.");
  }
  if (name === "lookup_knowledge") {
    const query = String(args.query ?? "");
    const matches = searchKnowledge(manifest.prompt.knowledge_entries ?? [], query);
    return {
      query,
      matches,
      note: matches.length
        ? "Use só estes fatos na resposta."
        : "Nenhum assunto encontrado. Não invente; diga que vai confirmar.",
    };
  }
  if (name === "send_reply") {
    const content = String(args.content ?? "");
    if (!content) throw new Error("send_reply exige content.");
    try {
      await client.sendMessage(ctx.conversationId, content);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new ManytalksSendErrorException(parseManytalksSendError(msg));
    }
    await emitDomainEvent(manifest.grokbot.id, "message_handled", {
      conversationId: String(ctx.conversationId),
      via: "send_reply",
    });
    return { ok: true };
  }
  if (name === "set_conversation_labels") {
    const allowed = new Set(manifest.labels.allowed_titles);
    const raw = await client.getLabels(ctx.conversationId);
    const current = unwrapList<string>(raw as { payload?: string[] } | string[]);
    const add = (Array.isArray(args.add) ? args.add : [])
      .map(String)
      .filter((t) => allowed.has(t));
    const remove = new Set((Array.isArray(args.remove) ? args.remove : []).map(String));
    const next = Array.from(new Set([...current, ...add])).filter((t) => !remove.has(t));
    next.sort();
    await client.setLabels(ctx.conversationId, next);
    const pause = next.some((t) => manifest.labels.pause_bot_on.includes(t));
    if (pause) await setPaused(manifest.grokbot.id, String(ctx.conversationId), "label");
    return { labels: next, paused: pause };
  }
  if (name === "move_kanban_card") {
    const stage = String(args.stage_id ?? "");
    const allowed = new Set(manifest.kanban.stages_allowed);
    if (!allowed.has(stage)) {
      throw new Error(`Estágio "${stage}" não permitido pela matriz.`);
    }
    if (!manifest.kanban.pipeline_id || !ctx.contactId) {
      throw new Error("Pipeline ou contato ausente para kanban.");
    }
    await client.moveKanban(ctx.contactId, manifest.kanban.pipeline_id, {
      stage_id: stage,
      position: typeof args.position === "number" ? args.position : 0,
      deal_value: typeof args.deal_value === "number" ? args.deal_value : undefined,
      metadata: { primary_conversation_id: ctx.conversationId },
    });
    if (manifest.kanban.pause_bot_stages.includes(stage)) {
      await setPaused(manifest.grokbot.id, String(ctx.conversationId), "kanban");
    }
    await emitDomainEvent(manifest.grokbot.id, "kanban.moved", {
      conversationId: String(ctx.conversationId),
      stage_id: stage,
      contactId: ctx.contactId ?? null,
    });
    return { stage_id: stage };
  }
  if (name === "search_contacts") {
    const p = manifest.tools_policy;
    if (!p.create_contact && !p.update_contact && !p.start_conversation) {
      throw new Error("Busca de contatos desabilitada.");
    }
    const q = String(args.q ?? "").trim();
    if (!q) throw new Error("search_contacts exige q.");
    const raw = await client.searchContacts(q);
    const list = unwrapList<Record<string, unknown>>(raw as never);
    return {
      q,
      count: list.length,
      contacts: list.slice(0, 25).map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        phone_number: c.phone_number,
        identifier: c.identifier,
      })),
    };
  }
  if (name === "create_contact") {
    if (!manifest.tools_policy.create_contact) {
      throw new Error("create_contact desabilitado no manifest.");
    }
    const inboxFallback = manifest.manytalks.enabled_inbox_ids[0] ?? null;
    const body = buildCreateContactBody(args, inboxFallback);
    const raw = await client.createContact(body);
    const newId = contactIdFromResponse(raw);
    await emitDomainEvent(manifest.grokbot.id, "contact.created", {
      contactId: newId,
      inbox_id: body.inbox_id,
    });
    return { ok: true, contact_id: newId, payload: raw };
  }
  if (name === "update_contact") {
    if (!manifest.tools_policy.update_contact) {
      throw new Error("update_contact desabilitado no manifest.");
    }
    const contactId = Number(args.contact_id ?? ctx.contactId ?? NaN);
    if (!Number.isFinite(contactId)) {
      throw new Error("update_contact exige contact_id.");
    }
    const patch = pickContactPatch(args);
    if (Object.keys(patch).length === 0) {
      throw new Error("update_contact: nenhum campo para atualizar.");
    }
    const raw = await client.updateContact(contactId, patch);
    await emitDomainEvent(manifest.grokbot.id, "contact.updated", { contactId });
    return { ok: true, contact_id: contactId, payload: raw };
  }
  if (name === "start_conversation") {
    if (!manifest.tools_policy.start_conversation) {
      throw new Error("start_conversation desabilitado no manifest.");
    }
    return runStartConversation(client, manifest, args, ctx.contactId);
  }
  if (name === "assign_conversation") {
    if (!manifest.tools_policy.assign_conversation) {
      throw new Error("assign_conversation desabilitado no manifest.");
    }
    const assigneeId = manifest.conversation_rules.default_assignee_id;
    if (assigneeId == null || !Number.isFinite(assigneeId)) {
      throw new Error("DEFAULT_MANYTALKS_ASSIGNEE_ID ausente no .env.");
    }
    await assignConversationToAgent(client, ctx.conversationId, assigneeId);
    return { ok: true, assignee_id: assigneeId, conversation_id: String(ctx.conversationId) };
  }
  if (name === "create_payment_link") {
    if (!manifest.asaas.allow_payment_link || !manifest.asaas.api_key) {
      throw new Error("Link de pagamento desabilitado ou Asaas sem chave.");
    }
    const asaas = createAsaasClient(manifest.asaas.environment, manifest.asaas.api_key);
    const link = await asaas.createPaymentLink({
      name: String(args.name ?? "Cobrança"),
      value: Number(args.value),
      description: args.description ? String(args.description) : undefined,
    });
    return { url: link.url, id: link.id };
  }
  if (name === "create_pix_charge") {
    if (!manifest.asaas.allow_pix_copy || !manifest.asaas.api_key) {
      throw new Error("PIX desabilitado ou Asaas sem chave.");
    }
    const pix = await createPixWithCustomer(
      manifest.asaas.environment,
      manifest.asaas.api_key,
      {
        name: String(args.customer_name ?? "Cliente"),
        value: Number(args.value),
        description: args.description ? String(args.description) : undefined,
      },
    );
    return pix;
  }
  throw new Error(`Tool desconhecida: ${name}`);
}

async function setPaused(grokbotId: string, conversationId: string, reason: string) {
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
