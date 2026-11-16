CREATE TABLE IF NOT EXISTS `operators` (
  `id` text PRIMARY KEY NOT NULL,
  `email` text NOT NULL UNIQUE,
  `password_hash` text NOT NULL,
  `created_at` text NOT NULL
);

CREATE TABLE IF NOT EXISTS `library_packages` (
  `id` text PRIMARY KEY NOT NULL,
  `slug` text NOT NULL UNIQUE,
  `name` text NOT NULL,
  `version` text NOT NULL,
  `payload_json` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);

CREATE TABLE IF NOT EXISTS `grokbots` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `enabled` integer NOT NULL DEFAULT 0,
  `manytalks_account_id` integer NOT NULL,
  `manytalks_base` text NOT NULL,
  `manifest_version` integer NOT NULL DEFAULT 0,
  `last_error` text,
  `last_health_at` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS `grokbots_account_idx` ON `grokbots` (`manytalks_account_id`);

CREATE TABLE IF NOT EXISTS `grokbots_config` (
  `grokbot_id` text PRIMARY KEY NOT NULL REFERENCES `grokbots`(`id`) ON DELETE CASCADE,
  `package_id` text REFERENCES `library_packages`(`id`),
  `follow_latest_package` integer NOT NULL DEFAULT 1,
  `knowledge` text NOT NULL DEFAULT '',
  `xai_model` text NOT NULL DEFAULT 'grok-2-latest',
  `xai_temperature` text NOT NULL DEFAULT '0.4',
  `max_history_messages` integer NOT NULL DEFAULT 30,
  `tools_policy_json` text NOT NULL,
  `labels_json` text NOT NULL,
  `kanban_json` text NOT NULL,
  `asaas_json` text NOT NULL,
  `post_payment_json` text NOT NULL,
  `conversation_rules_json` text NOT NULL,
  `checklist_ack_json` text NOT NULL
);

CREATE TABLE IF NOT EXISTS `grokbots_secrets` (
  `grokbot_id` text PRIMARY KEY NOT NULL REFERENCES `grokbots`(`id`) ON DELETE CASCADE,
  `manytalks_token_enc` text,
  `asaas_api_key_enc` text
);

CREATE TABLE IF NOT EXISTS `grokbots_inboxes` (
  `id` text PRIMARY KEY NOT NULL,
  `grokbot_id` text NOT NULL REFERENCES `grokbots`(`id`) ON DELETE CASCADE,
  `inbox_id` integer NOT NULL,
  `inbox_name` text
);
CREATE UNIQUE INDEX IF NOT EXISTS `grokbots_inboxes_uniq` ON `grokbots_inboxes` (`grokbot_id`, `inbox_id`);

CREATE TABLE IF NOT EXISTS `grokbots_runtime_tokens` (
  `id` text PRIMARY KEY NOT NULL,
  `grokbot_id` text NOT NULL REFERENCES `grokbots`(`id`) ON DELETE CASCADE,
  `token_hash` text NOT NULL,
  `token_prefix` text NOT NULL,
  `label` text NOT NULL DEFAULT 'default',
  `expires_at` text,
  `revoked_at` text,
  `created_at` text NOT NULL
);
CREATE INDEX IF NOT EXISTS `runtime_tokens_hash_idx` ON `grokbots_runtime_tokens` (`token_hash`);

CREATE TABLE IF NOT EXISTS `grokbots_manifest_snapshots` (
  `id` text PRIMARY KEY NOT NULL,
  `grokbot_id` text NOT NULL REFERENCES `grokbots`(`id`) ON DELETE CASCADE,
  `version` integer NOT NULL,
  `etag` text NOT NULL,
  `compiled_json` text NOT NULL,
  `published_at` text NOT NULL
);

CREATE TABLE IF NOT EXISTS `stage_rules` (
  `id` text PRIMARY KEY NOT NULL,
  `grokbot_id` text NOT NULL REFERENCES `grokbots`(`id`) ON DELETE CASCADE,
  `name` text NOT NULL,
  `condition` text NOT NULL,
  `target_stage_id` text NOT NULL,
  `add_labels_json` text NOT NULL DEFAULT '[]',
  `priority` integer NOT NULL DEFAULT 10,
  `active` integer NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS `processed_messages` (
  `id` text PRIMARY KEY NOT NULL,
  `grokbot_id` text NOT NULL REFERENCES `grokbots`(`id`) ON DELETE CASCADE,
  `message_id` text NOT NULL,
  `conversation_id` text NOT NULL,
  `processed_at` text NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS `processed_messages_uniq` ON `processed_messages` (`grokbot_id`, `message_id`);

CREATE TABLE IF NOT EXISTS `conversation_states` (
  `grokbot_id` text NOT NULL REFERENCES `grokbots`(`id`) ON DELETE CASCADE,
  `conversation_id` text NOT NULL,
  `bot_paused` integer NOT NULL DEFAULT 0,
  `pause_reason` text,
  `last_message_id` text,
  `updated_at` text NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS `conversation_states_uniq` ON `conversation_states` (`grokbot_id`, `conversation_id`);

CREATE TABLE IF NOT EXISTS `action_logs` (
  `id` text PRIMARY KEY NOT NULL,
  `grokbot_id` text NOT NULL REFERENCES `grokbots`(`id`) ON DELETE CASCADE,
  `conversation_id` text,
  `kind` text NOT NULL,
  `payload_redacted` text NOT NULL,
  `created_at` text NOT NULL
);
CREATE INDEX IF NOT EXISTS `action_logs_bot_idx` ON `action_logs` (`grokbot_id`, `created_at`);

CREATE TABLE IF NOT EXISTS `domain_events` (
  `id` text PRIMARY KEY NOT NULL,
  `grokbot_id` text NOT NULL REFERENCES `grokbots`(`id`) ON DELETE CASCADE,
  `type` text NOT NULL,
  `payload_json` text NOT NULL,
  `created_at` text NOT NULL
);
CREATE INDEX IF NOT EXISTS `domain_events_bot_idx` ON `domain_events` (`grokbot_id`, `created_at`);

CREATE TABLE IF NOT EXISTS `payment_events` (
  `id` text PRIMARY KEY NOT NULL,
  `grokbot_id` text NOT NULL REFERENCES `grokbots`(`id`) ON DELETE CASCADE,
  `asaas_event_id` text NOT NULL,
  `event_type` text NOT NULL,
  `payment_id` text,
  `amount` text,
  `status` text,
  `conversation_id` text,
  `payload_json` text NOT NULL,
  `created_at` text NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS `payment_events_asaas_uniq` ON `payment_events` (`asaas_event_id`);

CREATE TABLE IF NOT EXISTS `dashboards` (
  `grokbot_id` text PRIMARY KEY NOT NULL REFERENCES `grokbots`(`id`) ON DELETE CASCADE,
  `slug` text NOT NULL UNIQUE,
  `password_hash` text NOT NULL,
  `created_at` text NOT NULL
);

CREATE TABLE IF NOT EXISTS `dashboard_daily_stats` (
  `id` text PRIMARY KEY NOT NULL,
  `grokbot_id` text NOT NULL REFERENCES `grokbots`(`id`) ON DELETE CASCADE,
  `day` text NOT NULL,
  `stats_json` text NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS `dashboard_daily_uniq` ON `dashboard_daily_stats` (`grokbot_id`, `day`);

CREATE TABLE IF NOT EXISTS `jobs` (
  `id` text PRIMARY KEY NOT NULL,
  `type` text NOT NULL,
  `payload_json` text NOT NULL,
  `status` text NOT NULL DEFAULT 'pending',
  `run_at` text NOT NULL,
  `attempts` integer NOT NULL DEFAULT 0,
  `last_error` text,
  `created_at` text NOT NULL
);
CREATE INDEX IF NOT EXISTS `jobs_status_run_idx` ON `jobs` (`status`, `run_at`);
