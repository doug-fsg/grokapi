import { compileManifest } from "@/lib/manifest/compile";
import { loadPublishedManifest } from "@/lib/manifest/load-published";
import {
  integrationProbesOk,
  probeManifestCapabilities,
} from "@/lib/admin/manytalks-capability-probe";
import { runManytalksE2eSmoke, type E2eStep } from "@/lib/admin/e2e-manytalks-smoke";
import { appUrl, nowIso } from "@/lib/utils";
import { forwardToOutboundWebhook, getOutboundWebhook, type OutboundPayload } from "./outbound-forward";

export type IntegrationTestReport = {
  manytalks: { probes: Awaited<ReturnType<typeof probeManifestCapabilities>> };
  e2e: { ok: boolean; steps: E2eStep[] };
  relay: { ok: boolean; status: number; error?: string };
  all_ok: boolean;
};

function libraryUrls(grokbotId: string) {
  const base = appUrl();
  return {
    manifest_url: `${base}/api/library/v1/manifest`,
    tools_url: `${base}/api/library/v1/tools`,
    events_url: `${base}/api/library/v1/events`,
    grokbot_id: grokbotId,
  };
}

/** Dispara evento ao Grok (relay). Falha silenciosa se relay não configurado. */
export async function notifyOutboundIfConfigured(
  grokbotId: string,
  event: string,
  extra: Record<string, unknown> = {},
): Promise<{ sent: boolean; relay?: { ok: boolean; status: number; error?: string } }> {
  const outbound = await getOutboundWebhook(grokbotId);
  if (!outbound?.url) return { sent: false };

  const envelope: OutboundPayload = {
    schema_version: "1.0",
    event,
    grokbot_id: grokbotId,
    received_at: nowIso(),
    library: libraryUrls(grokbotId),
    ...extra,
  };

  const relay = await forwardToOutboundWebhook({
    grokbotId,
    url: outbound.url,
    authHeader: outbound.authHeader,
    authValue: outbound.authValue,
    envelope,
  });
  return { sent: true, relay };
}

export async function notifyManifestPublished(grokbotId: string) {
  const manifest = await loadPublishedManifest(grokbotId);
  return notifyOutboundIfConfigured(grokbotId, "manifest_published", {
    manifest_version: manifest?.manifest_version ?? null,
    etag: manifest?.etag ?? null,
    grokbot: manifest
      ? { id: manifest.grokbot.id, name: manifest.grokbot.name, enabled: manifest.grokbot.enabled }
      : null,
    hint: "Recarregue GET /api/library/v1/manifest com o runtime token.",
  });
}

/**
 * Probes read-only + E2E ManyTalks + notifica Grok (integration_test).
 * Grok deve responder no chat do operador com ✅ ou ❌.
 */
export async function runRelayIntegrationTest(
  grokbotId: string,
  opts?: { trigger?: "relay_saved" | "manual" },
): Promise<IntegrationTestReport> {
  const outbound = await getOutboundWebhook(grokbotId);
  if (!outbound?.url || !outbound.authValue) {
    throw new Error("Configure URL e chave do webhook de respostas.");
  }

  const manifest =
    (await loadPublishedManifest(grokbotId)) ??
    (await compileManifest(grokbotId, { includeSecrets: true }));
  if (!manifest) {
    throw new Error("Configuração incompleta — preencha ManyTalks e salve o bot.");
  }

  const probes = await probeManifestCapabilities(manifest);
  const probesOk = integrationProbesOk(probes);

  const e2e = await runManytalksE2eSmoke(manifest);
  const allOk = probesOk && e2e.ok;

  const envelope: OutboundPayload = {
    schema_version: "1.0",
    event: "integration_test",
    grokbot_id: grokbotId,
    received_at: nowIso(),
    trigger: opts?.trigger ?? "manual",
    ok: allOk,
    library: libraryUrls(grokbotId),
    manifest_version: manifest.manifest_version,
    etag: manifest.etag,
    manytalks: {
      account_id: manifest.manytalks.account_id,
      enabled_inbox_ids: manifest.manytalks.enabled_inbox_ids,
      probes,
      probes_ok: probesOk,
      e2e_ok: e2e.ok,
      e2e_steps: e2e.steps,
    },
    operator_chat: {
      required: true,
      reply_ok: "✅",
      reply_fail: "❌",
      hint: "Responda neste chat (thread do operador) com UMA linha: só ✅ se ok=true, ou ❌ e o passo que falhou.",
    },
    instruction:
      "integration_test: o ManyTalks já foi exercitado (contato, conversa aberta, etiqueta teste_api na conversa, kanban do bot, mensagem). " +
      "Não chame tools. Não peça credenciais. Responda no chat do operador conforme operator_chat.",
  };

  const relay = await forwardToOutboundWebhook({
    grokbotId,
    url: outbound.url,
    authHeader: outbound.authHeader,
    authValue: outbound.authValue,
    envelope,
  });

  return {
    manytalks: { probes },
    e2e,
    relay,
    all_ok: allOk && relay.ok,
  };
}