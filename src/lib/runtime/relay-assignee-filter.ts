import type { ConversationRules } from "@/lib/types/manifest";

type Payload = Record<string, unknown>;

export function assigneeIdFromConversation(conversation: Payload): number | null {
  const meta = conversation.meta as Payload | undefined;
  const assignee = (meta?.assignee ?? conversation.assignee) as Payload | undefined;
  const id = assignee?.id;
  if (typeof id === "number" && Number.isFinite(id)) return id;
  return null;
}

export type RelayAssigneeDecision = {
  relay: boolean;
  reason: string;
  assignee_id: number | null;
  bucket: "unassigned" | "assigned_to_me" | "assigned_other";
};

/** Decide se message_created segue para o Grok conforme atribuição da conversa. */
export function decideRelayByAssignee(
  rules: ConversationRules,
  assigneeId: number | null,
): RelayAssigneeDecision {
  const me = rules.default_assignee_id;
  const allowUnassigned = rules.relay_when_unassigned !== false;
  const allowMe = rules.relay_when_assigned_to_me !== false;

  if (assigneeId == null) {
    const relay = allowUnassigned;
    return {
      relay,
      reason: relay ? "ok: não atribuída" : "filtro: webhook só para atribuídas a mim",
      assignee_id: null,
      bucket: "unassigned",
    };
  }

  if (me != null && assigneeId === me) {
    const relay = allowMe;
    return {
      relay,
      reason: relay ? "ok: atribuída ao agente do bot" : "filtro: webhook só para não atribuídas",
      assignee_id: assigneeId,
      bucket: "assigned_to_me",
    };
  }

  return {
    relay: false,
    reason: `atribuída a outro agente (#${assigneeId}) — para de enviar ao Grok`,
    assignee_id: assigneeId,
    bucket: "assigned_other",
  };
}

/** Normaliza regras antigas (only_when_unassigned) para relay_when_*. */
export function normalizeConversationRules(rules: ConversationRules): ConversationRules {
  if (rules.only_when_unassigned) {
    return {
      ...rules,
      relay_when_unassigned: true,
      relay_when_assigned_to_me: false,
    };
  }
  return {
    ...rules,
    relay_when_unassigned: rules.relay_when_unassigned ?? true,
    relay_when_assigned_to_me: rules.relay_when_assigned_to_me ?? true,
  };
}