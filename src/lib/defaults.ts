import type {
  ConversationRules,
  GrokbotLabels,
  PostPaymentConfig,
  ToolsPolicy,
} from "@/lib/types/manifest";
import { defaultManytalksAssigneeId } from "@/lib/manytalks/default-assignee";

export const defaultToolsPolicy: ToolsPolicy = {
  send_reply: true,
  set_conversation_labels: true,
  move_kanban_card: false,
  create_contact: true,
  update_contact: true,
  create_payment_link: false,
  create_pix_charge: false,
  start_conversation: true,
  assign_conversation: true,
};

export const defaultContactsPolicy = { allow_delete: false as const };

export const defaultConversationRules: ConversationRules = {
  statuses: ["open", "pending"],
  only_incoming: true,
  only_when_unassigned: false,
  ignore_private: true,
  execute_tools_before_reply: true,
  default_assignee_id: defaultManytalksAssigneeId(),
  auto_assign_on_message: true,
  relay_when_unassigned: true,
  relay_when_assigned_to_me: true,
};

export function emptyKanban() {
  return {
    pipeline_id: null as number | null,
    stages_allowed: [] as string[],
    pause_bot_stages: [] as string[],
    /** Coluna que = “bateu o objetivo” (varredura de padrões). */
    objetivo_stage_id: null as string | null,
  };
}

export function emptyAsaas() {
  return {
    environment: "sandbox" as const,
    allow_payment_link: true,
    allow_pix_copy: false,
    split_note: "Split configurado no painel Asaas da subconta",
  };
}

export function emptyPostPayment(): PostPaymentConfig {
  return {
    crm_enabled: false,
    labels_on_paid: ["pago"],
    kanban_stage_on_paid: "Ganho",
    message_enabled: false,
    message_template: "Recebemos, {{nome}}! Próximo passo: ...",
  };
}

export function emptyLabels(): GrokbotLabels {
  return {
    allowed_titles: [],
    meanings: {},
    pause_bot_on: [],
  };
}
