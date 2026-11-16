export function pickDisplayId(conv: Record<string, unknown>): string | null {
  const display =
    conv.display_id ??
    (conv as { meta?: { display_id?: unknown } }).meta?.display_id ??
    conv.id;
  if (display == null || display === "") return null;
  return String(display);
}

export function unwrapConversations(raw: unknown): Record<string, unknown>[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as Record<string, unknown>[];
  const o = raw as { data?: unknown; payload?: unknown[] };
  if (Array.isArray(o.payload)) return o.payload as Record<string, unknown>[];
  if (Array.isArray(o.data)) return o.data as Record<string, unknown>[];
  if (o.data && typeof o.data === "object") {
    const inner = o.data as { payload?: unknown[] };
    if (Array.isArray(inner.payload)) return inner.payload as Record<string, unknown>[];
  }
  return [];
}

export function isWhatsappConversation(conv: Record<string, unknown>): boolean {
  const meta = (conv.meta ?? {}) as Record<string, unknown>;
  const inbox = (meta.inbox ?? {}) as Record<string, unknown>;
  const blob = [
    conv.channel,
    meta.channel,
    inbox.channel_type,
    inbox.channel,
    inbox.name,
    inbox.medium,
  ]
    .map((x) => String(x ?? "").toLowerCase())
    .join(" ");
  return /whatsapp|wa_cloud|channel::whatsapp/.test(blob);
}

export function pickAssigneeName(conv: Record<string, unknown>): string {
  const meta = (conv.meta ?? {}) as {
    assignee?: { name?: string; available_name?: string };
  };
  const name = meta.assignee?.name || meta.assignee?.available_name;
  return name?.trim() || "sem-atendente";
}

export function pickKanbanStage(conv: Record<string, unknown>): string | null {
  const ca = (conv.custom_attributes ?? conv.additional_attributes ?? {}) as Record<
    string,
    unknown
  >;
  const meta = (conv.meta ?? {}) as Record<string, unknown>;
  const pp = (meta.pipeline_position ??
    conv.pipeline_position ??
    ca.pipeline_position) as Record<string, unknown> | undefined;
  const stage = pp?.stage_id ?? pp?.stage ?? ca.stage_id ?? ca.kanban_stage ?? meta.stage_id;
  const s = stage == null ? "" : String(stage).trim();
  return s || null;
}

export function pickContactName(conv: Record<string, unknown>, displayId: string): string {
  const meta = conv.meta as { sender?: { name?: string } } | undefined;
  return String(meta?.sender?.name ?? `conv-${displayId}`).slice(0, 80);
}

type ListClient = {
  listConversations(query: {
    status?: string;
    inboxId?: number | null;
    labels?: string[];
    page?: number;
  }): Promise<unknown>;
};

export async function listConversationsMatching(opts: {
  client: ListClient;
  status: string;
  inboxId: number | null;
  labels: string[];
  allowedInboxIds: Set<number>;
  max: number;
  whatsappOnly: boolean;
  resolvedInboxBug: boolean;
  onPage?: (n: number, listed: number) => void | Promise<void>;
  shouldAbort?: () => Promise<void>;
}): Promise<Record<string, unknown>[]> {
  const conversations: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  let page = 1;
  const apiStatus = opts.resolvedInboxBug ? "all" : opts.status;

  while (conversations.length < opts.max && page <= 8) {
    await opts.shouldAbort?.();
    const raw = await opts.client.listConversations({
      status: apiStatus,
      inboxId: opts.inboxId,
      labels: opts.labels,
      page,
    });
    const batch = unwrapConversations(raw);
    if (!batch.length) break;
    for (const conv of batch) {
      if (opts.resolvedInboxBug && String(conv.status ?? "") !== "resolved") continue;
      if (opts.whatsappOnly && !isWhatsappConversation(conv)) continue;
      const inboxId = Number(
        conv.inbox_id ?? (conv.meta as { inbox?: { id?: number } } | undefined)?.inbox?.id,
      );
      if (
        opts.inboxId == null &&
        opts.allowedInboxIds.size > 0 &&
        Number.isFinite(inboxId) &&
        !opts.allowedInboxIds.has(inboxId)
      ) {
        continue;
      }
      const id = pickDisplayId(conv);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      conversations.push(conv);
      if (conversations.length >= opts.max) break;
    }
    await opts.onPage?.(page, conversations.length);
    if (batch.length < 10) break;
    page += 1;
  }
  return conversations;
}
