import { createManytalksClient } from "@/lib/manytalks/client";
import { assignConversationToAgent } from "@/lib/manytalks/conversation-lifecycle";
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

function currentAssigneeId(conversation: Payload): number | null {
  const meta = conversation.meta as Payload | undefined;
  const assignee = (meta?.assignee ?? conversation.assignee) as Payload | undefined;
  const id = assignee?.id;
  if (typeof id === "number" && Number.isFinite(id)) return id;
  return null;
}

/** Atribuição automática antes do relay — não consome tokens do Grok. */
export async function tryAutoAssignOnMessage(
  manifest: ManifestV1,
  conversationId: string,
  conversation: Payload,
): Promise<{ assigned: boolean; assignee_id?: number }> {
  const rules = manifest.conversation_rules;
  const assigneeId = rules.default_assignee_id;
  if (!rules.auto_assign_on_message || assigneeId == null || !Number.isFinite(assigneeId)) {
    return { assigned: false };
  }
  if (rules.only_when_unassigned && currentAssigneeId(conversation) != null) {
    return { assigned: false };
  }
  const existing = currentAssigneeId(conversation);
  if (existing === assigneeId) return { assigned: false };

  const client = createManytalksClient({
    base: manifest.manytalks.base_url,
    accountId: manifest.manytalks.account_id,
    token: manifest.manytalks.api_access_token,
  });
  try {
    await assignConversationToAgent(client, conversationId, assigneeId);
    return { assigned: true, assignee_id: assigneeId };
  } catch {
    return { assigned: false };
  }
}