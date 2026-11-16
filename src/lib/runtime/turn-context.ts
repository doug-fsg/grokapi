type Payload = Record<string, unknown>;

function nested(obj: Payload, ...keys: string[]) {
  let cur: unknown = obj;
  for (const k of keys) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Payload)[k];
  }
  return cur;
}

/** Campos usados pelo handler a partir do webhook message_created. */
export function digestMessageWebhook(body: Payload) {
  const message = (body.message ?? nested(body, "payload") ?? body) as Payload;
  const conversation = (body.conversation ?? nested(message, "conversation") ?? {}) as Payload;
  const messageType = String(message.message_type ?? message.type ?? "");
  const isIncoming =
    messageType === "incoming" || messageType === "0" || Number(message.message_type) === 0;
  const conversationId = String(conversation.id ?? conversation.display_id ?? "");
  const messageId = String(message.id ?? "");
  const content = String(message.content ?? "").trim();

  return {
    message_id: messageId,
    conversation_id: conversationId,
    from: isIncoming ? ("client" as const) : ("agent" as const),
    content,
  };
}

export type GrokTurnContext = {
  conversation_id: string;
  contact_id: number | null;
  contact_name: string | null;
  inbox_id: number;
  status: string;
  etiquetas: string[];
};

export function buildGrokTurnContext(input: {
  digest: ReturnType<typeof digestMessageWebhook>;
  contactId?: number;
  contactName?: string | null;
  inboxId: number;
  status: string;
  labels: string[];
}): GrokTurnContext {
  return {
    conversation_id: input.digest.conversation_id,
    contact_id: input.contactId ?? null,
    contact_name: input.contactName ?? null,
    inbox_id: input.inboxId,
    status: input.status,
    etiquetas: [...input.labels].sort(),
  };
}

export function formatGrokTurnContext(ctx: GrokTurnContext): string {
  return `Contexto deste turno:\n${JSON.stringify(ctx, null, 2)}`;
}
