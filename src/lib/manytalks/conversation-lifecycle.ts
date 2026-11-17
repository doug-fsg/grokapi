import type { ManifestV1 } from "@/lib/types/manifest";
import type { createManytalksClient } from "@/lib/manytalks/client";
import { unwrapList } from "@/lib/manytalks/client";
import {
  buildCreateContactBody,
  contactIdFromResponse,
  normalizePhoneE164,
} from "@/lib/manytalks/contacts";

export function conversationIdFromResponse(data: Record<string, unknown>): string | null {
  const id = data.id ?? (data as { display_id?: unknown }).display_id;
  if (id != null) return String(id);
  const payload = data.payload as Record<string, unknown> | undefined;
  if (payload?.id != null) return String(payload.id);
  return null;
}

function conversationInboxId(row: Record<string, unknown>): number | null {
  const raw = row.inbox_id;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim()) return Number(raw);
  return null;
}

export type EnsureConversationResult = {
  displayId: string;
  created: boolean;
};

/** Abre ou cria conversa na inbox; garante status open; envia mensagem opcional. */
export async function ensureConversationOpen(
  client: ReturnType<typeof createManytalksClient>,
  contactId: number,
  inboxId: number,
  initialMessage?: string,
): Promise<EnsureConversationResult> {
  const msg = initialMessage?.trim() || "Olá!";
  const existing = unwrapList<Record<string, unknown>>(
    (await client.listContactConversations(contactId)) as never,
  );
  const inInbox =
    existing.find((c) => conversationInboxId(c) === inboxId) ??
    existing.find((c) => conversationInboxId(c) == null);

  if (inInbox) {
    const displayId = conversationIdFromResponse(inInbox);
    if (!displayId) throw new Error("conversa existente sem display_id");
    const conv = await client.getConversation(displayId);
    const status = String(conv.status ?? "open");
    if (status !== "open") {
      await client.toggleConversationStatus(displayId, "open");
    }
    if (initialMessage?.trim()) {
      await client.sendMessage(displayId, msg);
    }
    return { displayId, created: false };
  }

  const created = await client.createConversation({
    inbox_id: inboxId,
    contact_id: contactId,
    source_id: `mtb-${contactId}-${inboxId}-${Date.now()}`,
    message: { content: msg },
  });
  const displayId = conversationIdFromResponse(created);
  if (!displayId) throw new Error("create conversation sem display_id");
  const conv = await client.getConversation(displayId);
  const status = String(conv.status ?? "open");
  if (status !== "open") {
    await client.toggleConversationStatus(displayId, "open");
  }
  return { displayId, created: true };
}

export async function assignConversationToAgent(
  client: ReturnType<typeof createManytalksClient>,
  displayId: string | number,
  assigneeId: number,
): Promise<void> {
  if (!Number.isFinite(assigneeId) || assigneeId <= 0) {
    throw new Error("assignee_id inválido.");
  }
  await client.assignConversation(displayId, assigneeId);
}

export async function resolveContactIdForStart(
  client: ReturnType<typeof createManytalksClient>,
  manifest: ManifestV1,
  args: Record<string, unknown>,
  ctxContactId?: number,
): Promise<number> {
  const direct = Number(args.contact_id ?? ctxContactId ?? NaN);
  if (Number.isFinite(direct)) return direct;

  const phone = args.phone_number != null ? String(args.phone_number).trim() : "";
  const name = args.name != null ? String(args.name).trim() : "";
  if (!phone && !name) {
    throw new Error("start_conversation: informe contact_id ou phone_number (e name se criar).");
  }

  if (phone) {
    const digits = phone.replace(/\D/g, "").slice(-8);
    const search = unwrapList<Record<string, unknown>>(
      (await client.searchContacts(digits || phone)) as never,
    );
    const e164 = normalizePhoneE164(phone);
    const match = search.find((c) => {
      const p = String(c.phone_number ?? "").replace(/\D/g, "");
      return p.includes(digits) || p === e164.replace(/\D/g, "");
    });
    if (match?.id != null) return Number(match.id);
  }

  if (!manifest.tools_policy.create_contact) {
    throw new Error("Contato não encontrado e create_contact está desligado.");
  }
  const inbox =
    Number(args.inbox_id) ||
    manifest.manytalks.enabled_inbox_ids[0];
  if (!Number.isFinite(inbox)) throw new Error("inbox_id ausente.");
  const body = buildCreateContactBody(
    { name: name || "Contato", phone_number: phone || undefined, inbox_id: inbox },
    inbox,
  );
  const raw = await client.createContact(body);
  const newId = contactIdFromResponse(raw);
  if (!newId) throw new Error("create_contact sem id.");
  return newId;
}

/** Um único passo no servidor: contato → conversa aberta → mensagem → atribuição. */
export async function runStartConversation(
  client: ReturnType<typeof createManytalksClient>,
  manifest: ManifestV1,
  args: Record<string, unknown>,
  ctxContactId?: number,
) {
  const inboxId = Number(args.inbox_id) || manifest.manytalks.enabled_inbox_ids[0];
  if (!Number.isFinite(inboxId)) throw new Error("Nenhuma inbox habilitada.");
  const contactId = await resolveContactIdForStart(client, manifest, args, ctxContactId);
  const firstMessage = args.first_message != null ? String(args.first_message) : undefined;
  const conv = await ensureConversationOpen(client, contactId, inboxId, firstMessage);

  let assigned = false;
  const assigneeId = manifest.conversation_rules.default_assignee_id;
  const shouldAssign =
    args.assign !== false && assigneeId != null && Number.isFinite(assigneeId) && assigneeId > 0;
  if (shouldAssign) {
    await assignConversationToAgent(client, conv.displayId, assigneeId);
    assigned = true;
  }

  return {
    ok: true,
    conversation_id: conv.displayId,
    contact_id: contactId,
    inbox_id: inboxId,
    created: conv.created,
    assigned,
    assignee_id: assigned ? assigneeId : null,
  };
}