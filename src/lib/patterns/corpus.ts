import { unwrapList } from "@/lib/manytalks/client";

type MessagesClient = {
  getMessages(
    displayId: string | number,
    query?: { before?: number },
  ): Promise<unknown>;
};

/** Chatwoot/ManyTalks: 0 incoming, 1 outgoing, 2 activity. */
export function isPublicChatMessage(m: Record<string, unknown>): boolean {
  if (Boolean(m.private)) return false;
  const raw = m.message_type ?? m.type;
  const type = String(raw ?? "");
  const n = typeof raw === "number" ? raw : Number(raw);
  if (type === "incoming" || type === "0" || n === 0) return true;
  if (type === "outgoing" || type === "1" || n === 1) return true;
  return false;
}

export function messageLine(m: Record<string, unknown>): string | null {
  if (!isPublicChatMessage(m)) return null;
  const content = String(m.content ?? "").trim();
  if (!content) return null;
  const raw = m.message_type ?? m.type;
  const type = String(raw ?? "");
  const n = typeof raw === "number" ? raw : Number(raw);
  const from =
    type === "incoming" || type === "0" || n === 0 ? "cliente" : "agente";
  return `${from}: ${content.slice(0, 500)}`;
}

/**
 * Carrega as mensagens públicas mais recentes, paginando com `before`.
 * Activity/sistema ficam de fora.
 */
export async function loadRecentPublicMessages(
  client: MessagesClient,
  displayId: string | number,
  maxMsgs: number,
  /** Páginas ManyTalks; 2–3 costuma bastar (1 página ~20 msgs). */
  maxPages = 3,
): Promise<Record<string, unknown>[]> {
  const byId = new Map<number, Record<string, unknown>>();
  let before: number | undefined;

  for (let page = 0; page < maxPages; page++) {
    const raw = await client.getMessages(
      displayId,
      before != null ? { before } : undefined,
    );
    const batch = unwrapList<Record<string, unknown>>(
      raw as { payload?: Record<string, unknown>[] } | Record<string, unknown>[],
    );
    if (!batch.length) break;

    let minId: number | null = null;
    for (const m of batch) {
      const id = Number(m.id);
      if (!Number.isFinite(id)) continue;
      byId.set(id, m);
      if (minId == null || id < minId) minId = id;
    }

    const publicCount = [...byId.values()].filter(isPublicChatMessage).length;
    if (publicCount >= maxMsgs) break;
    if (batch.length < 8) break;
    if (minId == null || minId === before) break;
    before = minId;
  }

  return [...byId.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, m]) => m)
    .filter(isPublicChatMessage)
    .slice(-maxMsgs);
}
