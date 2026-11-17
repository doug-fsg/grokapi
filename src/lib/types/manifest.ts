export type ToolsPolicy = {
  send_reply: boolean;
  set_conversation_labels: boolean;
  move_kanban_card: boolean;
  create_contact: boolean;
  update_contact: boolean;
  create_payment_link: boolean;
  create_pix_charge: boolean;
  /** Contato + conversa aberta + 1ª mensagem no servidor (economiza tokens). */
  start_conversation: boolean;
  /** Atribuir conversa ao agente padrão (assignee no manifest). */
  assign_conversation: boolean;
};

export type ContactsPolicy = {
  /** Sempre false no produto — exclusão não exposta ao runtime. */
  allow_delete: false;
};

export type StageRuleManifest = {
  name: string;
  condition: string;
  target_stage_id: string;
  add_labels: string[];
  priority: number;
  active: boolean;
};

export type GrokbotLabels = {
  allowed_titles: string[];
  meanings: Record<string, string>;
  pause_bot_on: string[];
};

export type PostPaymentConfig = {
  crm_enabled: boolean;
  labels_on_paid: string[];
  kanban_stage_on_paid: string;
  message_enabled: boolean;
  message_template: string;
};

export type ConversationRules = {
  statuses: string[];
  only_incoming: boolean;
  only_when_unassigned: boolean;
  ignore_private: boolean;
  execute_tools_before_reply: boolean;
  /** ID do agente ManyTalks que “é o bot” (atribuição). */
  default_assignee_id: number | null;
  /** Antes de repassar message_created ao Grok (sem gastar tool). */
  auto_assign_on_message: boolean;
  /** Envia message_created ao Grok quando conversa sem responsável. */
  relay_when_unassigned: boolean;
  /** Envia message_created quando responsável = default_assignee_id. */
  relay_when_assigned_to_me: boolean;
  /** In-process xAI nesta instância; default = true quando XAI_API_KEY existe. */
  use_in_process_grok?: boolean;
};

export type ManifestV1 = {
  schema_version: "1.0";
  manifest_version: number;
  etag: string;
  grokbot: { id: string; name: string; enabled: boolean };
  manytalks: {
    base_url: string;
    account_id: number;
    api_access_token: string;
    enabled_inbox_ids: number[];
    webhook_subscriptions: string[];
  };
  xai: {
    model: string;
    temperature: number;
    max_history_messages: number;
  };
  prompt: {
    system_compiled: string;
    knowledge: string;
    knowledge_entries: { title: string; body: string }[];
  };
  tools_policy: ToolsPolicy;
  contacts_policy: ContactsPolicy;
  labels: GrokbotLabels;
  kanban: {
    pipeline_id: number | null;
    stages_allowed: string[];
    pause_bot_stages: string[];
    stage_rules: StageRuleManifest[];
  };
  asaas: {
    environment: "sandbox" | "production";
    api_key: string;
    allow_payment_link: boolean;
    allow_pix_copy: boolean;
    split_note: string;
  };
  post_payment: PostPaymentConfig;
  conversation_rules: ConversationRules;
  dashboard: { slug: string | null; has_password: boolean };
  checklist_ack: {
    capitao_off_inboxes: boolean;
    manytalks_webhook_ok?: boolean;
    manytalks_webhook_at?: string | null;
    asaas_webhook_ack?: boolean;
  };
};
