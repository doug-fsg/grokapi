import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { grokbots, grokbotsInboxes } from "@/lib/db/schema";

type Payload = Record<string, unknown>;

function nested(obj: Payload, ...keys: string[]) {
  let cur: unknown = obj;
  for (const k of keys) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Payload)[k];
  }
  return cur;
}

/** Extrai inbox_id dos formatos comuns Chatwoot/ManyTalks. */
export function extractInboxId(body: Payload): number | null {
  const message = (body.message ?? nested(body, "payload") ?? body) as Payload;
  const conversation = (body.conversation ??
    nested(message, "conversation") ??
    {}) as Payload;
  const raw =
    nested(body, "inbox", "id") ??
    conversation.inbox_id ??
    nested(message, "inbox_id") ??
    nested(message, "inbox", "id") ??
    body.inbox_id ??
    nested(body, "conversation", "inbox_id");
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export async function loadBotGate(grokbotId: string) {
  const db = getDb();
  const [bot] = await db.select().from(grokbots).where(eq(grokbots.id, grokbotId)).limit(1);
  if (!bot) return null;
  const rows = await db
    .select({ inboxId: grokbotsInboxes.inboxId })
    .from(grokbotsInboxes)
    .where(eq(grokbotsInboxes.grokbotId, grokbotId));
  return {
    enabled: bot.enabled,
    inboxIds: rows.map((r) => r.inboxId),
  };
}

/** true = processar; string = motivo do skip. */
export function shouldProcessInbox(
  inboxId: number | null,
  configured: number[],
): true | string {
  if (!configured.length) return "nenhuma inbox configurada no ManyTalks Bot";
  if (inboxId == null) return "webhook sem inbox_id";
  if (!configured.includes(inboxId)) {
    return `inbox ${inboxId} fora da lista (${configured.join(",")})`;
  }
  return true;
}
