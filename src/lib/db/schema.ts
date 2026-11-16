import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const operators = sqliteTable("operators", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: text("created_at").notNull(),
});

export const grokbots = sqliteTable(
  "grokbots",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
    manytalksAccountId: integer("manytalks_account_id").notNull(),
    manytalksBase: text("manytalks_base").notNull(),
    manifestVersion: integer("manifest_version").notNull().default(0),
    lastError: text("last_error"),
    lastHealthAt: text("last_health_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [uniqueIndex("grokbots_account_idx").on(t.manytalksAccountId)],
);

export const grokbotsConfig = sqliteTable("grokbots_config", {
  grokbotId: text("grokbot_id")
    .primaryKey()
    .references(() => grokbots.id, { onDelete: "cascade" }),
  knowledge: text("knowledge").notNull().default(""),
  xaiModel: text("xai_model").notNull().default("grok-2-latest"),
  xaiTemperature: text("xai_temperature").notNull().default("0.4"),
  maxHistoryMessages: integer("max_history_messages").notNull().default(30),
  toolsPolicyJson: text("tools_policy_json").notNull(),
  labelsJson: text("labels_json").notNull(),
  kanbanJson: text("kanban_json").notNull(),
  asaasJson: text("asaas_json").notNull(),
  postPaymentJson: text("post_payment_json").notNull(),
  conversationRulesJson: text("conversation_rules_json").notNull(),
  checklistAckJson: text("checklist_ack_json").notNull(),
  /** URL HTTPS do runtime externo — relay ManyTalks → este endpoint. */
  outboundWebhookUrl: text("outbound_webhook_url"),
  outboundWebhookSecret: text("outbound_webhook_secret"),
  /** Nome do header no POST de relay (ex. Authorization). Valor em outboundWebhookSecret. */
  outboundWebhookAuthHeader: text("outbound_webhook_auth_header"),
  outboundWebhookConfiguredAt: text("outbound_webhook_configured_at"),
});

export const grokbotsSecrets = sqliteTable("grokbots_secrets", {
  grokbotId: text("grokbot_id")
    .primaryKey()
    .references(() => grokbots.id, { onDelete: "cascade" }),
  manytalksTokenEnc: text("manytalks_token_enc"),
  asaasApiKeyEnc: text("asaas_api_key_enc"),
});

export const grokbotsInboxes = sqliteTable(
  "grokbots_inboxes",
  {
    id: text("id").primaryKey(),
    grokbotId: text("grokbot_id")
      .notNull()
      .references(() => grokbots.id, { onDelete: "cascade" }),
    inboxId: integer("inbox_id").notNull(),
    inboxName: text("inbox_name"),
  },
  (t) => [uniqueIndex("grokbots_inboxes_uniq").on(t.grokbotId, t.inboxId)],
);

export const grokbotsRuntimeTokens = sqliteTable(
  "grokbots_runtime_tokens",
  {
    id: text("id").primaryKey(),
    grokbotId: text("grokbot_id")
      .notNull()
      .references(() => grokbots.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    tokenPrefix: text("token_prefix").notNull(),
    label: text("label").notNull().default("default"),
    expiresAt: text("expires_at"),
    revokedAt: text("revoked_at"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("runtime_tokens_hash_idx").on(t.tokenHash)],
);

export const grokbotsManifestSnapshots = sqliteTable(
  "grokbots_manifest_snapshots",
  {
    id: text("id").primaryKey(),
    grokbotId: text("grokbot_id")
      .notNull()
      .references(() => grokbots.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    etag: text("etag").notNull(),
    compiledJson: text("compiled_json").notNull(),
    publishedAt: text("published_at").notNull(),
  },
);

export const stageRules = sqliteTable("stage_rules", {
  id: text("id").primaryKey(),
  grokbotId: text("grokbot_id")
    .notNull()
    .references(() => grokbots.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  condition: text("condition").notNull(),
  targetStageId: text("target_stage_id").notNull(),
  addLabelsJson: text("add_labels_json").notNull().default("[]"),
  priority: integer("priority").notNull().default(10),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

export const processedMessages = sqliteTable(
  "processed_messages",
  {
    id: text("id").primaryKey(),
    grokbotId: text("grokbot_id")
      .notNull()
      .references(() => grokbots.id, { onDelete: "cascade" }),
    messageId: text("message_id").notNull(),
    conversationId: text("conversation_id").notNull(),
    processedAt: text("processed_at").notNull(),
  },
  (t) => [
    uniqueIndex("processed_messages_uniq").on(t.grokbotId, t.messageId),
  ],
);

export const conversationStates = sqliteTable(
  "conversation_states",
  {
    grokbotId: text("grokbot_id")
      .notNull()
      .references(() => grokbots.id, { onDelete: "cascade" }),
    conversationId: text("conversation_id").notNull(),
    botPaused: integer("bot_paused", { mode: "boolean" }).notNull().default(false),
    pauseReason: text("pause_reason"),
    lastMessageId: text("last_message_id"),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("conversation_states_uniq").on(t.grokbotId, t.conversationId),
  ],
);

export const actionLogs = sqliteTable(
  "action_logs",
  {
    id: text("id").primaryKey(),
    grokbotId: text("grokbot_id")
      .notNull()
      .references(() => grokbots.id, { onDelete: "cascade" }),
    conversationId: text("conversation_id"),
    kind: text("kind").notNull(),
    payloadRedacted: text("payload_redacted").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("action_logs_bot_idx").on(t.grokbotId, t.createdAt)],
);

export const domainEvents = sqliteTable(
  "domain_events",
  {
    id: text("id").primaryKey(),
    grokbotId: text("grokbot_id")
      .notNull()
      .references(() => grokbots.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    payloadJson: text("payload_json").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("domain_events_bot_idx").on(t.grokbotId, t.createdAt)],
);

export const paymentEvents = sqliteTable(
  "payment_events",
  {
    id: text("id").primaryKey(),
    grokbotId: text("grokbot_id")
      .notNull()
      .references(() => grokbots.id, { onDelete: "cascade" }),
    asaasEventId: text("asaas_event_id").notNull(),
    eventType: text("event_type").notNull(),
    paymentId: text("payment_id"),
    amount: text("amount"),
    status: text("status"),
    conversationId: text("conversation_id"),
    payloadJson: text("payload_json").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [uniqueIndex("payment_events_asaas_uniq").on(t.asaasEventId)],
);

export const dashboards = sqliteTable("dashboards", {
  grokbotId: text("grokbot_id")
    .primaryKey()
    .references(() => grokbots.id, { onDelete: "cascade" }),
  slug: text("slug").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  passwordEnc: text("password_enc"),
  createdAt: text("created_at").notNull(),
});

export const dashboardDailyStats = sqliteTable(
  "dashboard_daily_stats",
  {
    id: text("id").primaryKey(),
    grokbotId: text("grokbot_id")
      .notNull()
      .references(() => grokbots.id, { onDelete: "cascade" }),
    day: text("day").notNull(),
    statsJson: text("stats_json").notNull(),
  },
  (t) => [uniqueIndex("dashboard_daily_uniq").on(t.grokbotId, t.day)],
);

export const jobs = sqliteTable(
  "jobs",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    payloadJson: text("payload_json").notNull(),
    status: text("status").notNull().default("pending"),
    runAt: text("run_at").notNull(),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("jobs_status_run_idx").on(t.status, t.runAt)],
);

/** Playbook: varredura opcional na base de conversas (filtros controlam custo×precisão). */
export const patternScans = sqliteTable(
  "pattern_scans",
  {
    id: text("id").primaryKey(),
    grokbotId: text("grokbot_id")
      .notNull()
      .references(() => grokbots.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"),
    /** Resumo legível dos filtros (legado: coluna objetivo). */
    objetivoStageId: text("objetivo_stage_id").notNull(),
    filtersJson: text("filters_json"),
    draftJson: text("draft_json"),
    modelUsed: text("model_used"),
    modelsTriedJson: text("models_tried_json"),
    sampledJson: text("sampled_json"),
    error: text("error"),
    createdAt: text("created_at").notNull(),
    sentAt: text("sent_at"),
  },
  (t) => [index("pattern_scans_bot_created_idx").on(t.grokbotId, t.createdAt)],
);
