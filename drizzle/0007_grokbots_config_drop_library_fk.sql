-- grokbots_config ainda tinha REFERENCES library_packages após 0002_drop_library.
-- SQLite falha em qualquer acesso com FK apontando para tabela inexistente.
PRAGMA foreign_keys=OFF;

DROP TABLE IF EXISTS `grokbots_config__next`;

CREATE TABLE `grokbots_config__next` (
  `grokbot_id` text PRIMARY KEY NOT NULL REFERENCES `grokbots`(`id`) ON DELETE CASCADE,
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
  `checklist_ack_json` text NOT NULL,
  `outbound_webhook_url` text,
  `outbound_webhook_secret` text,
  `outbound_webhook_auth_header` text,
  `outbound_webhook_configured_at` text
);

INSERT INTO `grokbots_config__next` (
  `grokbot_id`,
  `knowledge`,
  `xai_model`,
  `xai_temperature`,
  `max_history_messages`,
  `tools_policy_json`,
  `labels_json`,
  `kanban_json`,
  `asaas_json`,
  `post_payment_json`,
  `conversation_rules_json`,
  `checklist_ack_json`,
  `outbound_webhook_url`,
  `outbound_webhook_secret`,
  `outbound_webhook_auth_header`,
  `outbound_webhook_configured_at`
)
SELECT
  `grokbot_id`,
  `knowledge`,
  `xai_model`,
  `xai_temperature`,
  `max_history_messages`,
  `tools_policy_json`,
  `labels_json`,
  `kanban_json`,
  `asaas_json`,
  `post_payment_json`,
  `conversation_rules_json`,
  `checklist_ack_json`,
  `outbound_webhook_url`,
  `outbound_webhook_secret`,
  `outbound_webhook_auth_header`,
  `outbound_webhook_configured_at`
FROM `grokbots_config`;

DROP TABLE `grokbots_config`;

ALTER TABLE `grokbots_config__next` RENAME TO `grokbots_config`;

PRAGMA foreign_keys=ON;