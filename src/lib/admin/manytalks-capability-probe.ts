import { createManytalksClient, unwrapList } from "@/lib/manytalks/client";
import { createAsaasClient } from "@/lib/asaas/client";
import type { ManifestV1 } from "@/lib/types/manifest";

export type CapabilityProbe = {
  id: string;
  name: string;
  ok: boolean;
  skipped?: boolean;
  detail?: string;
};

async function probe(
  id: string,
  name: string,
  fn: () => Promise<string | void>,
): Promise<CapabilityProbe> {
  try {
    const detail = await fn();
    return { id, name, ok: true, detail: detail ?? undefined };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { id, name, ok: false, detail: detail.slice(0, 400) };
  }
}

function skip(id: string, name: string, reason: string): CapabilityProbe {
  return { id, name, ok: true, skipped: true, detail: reason };
}

/** Probes ignorados (ex. Asaas sem chave) não bloqueiam integration_test. */
export function integrationProbesOk(probes: CapabilityProbe[]): boolean {
  return probes.filter((p) => !p.skipped).every((p) => p.ok);
}

export function asaasProbeFromManifest(manifest: ManifestV1): CapabilityProbe {
  const policy = manifest.tools_policy;
  const pay =
    (policy.create_payment_link && manifest.asaas.allow_payment_link) ||
    (policy.create_pix_charge && manifest.asaas.allow_pix_copy);
  if (pay && manifest.asaas.api_key) {
    return { id: "asaas", name: "Asaas", ok: true, detail: "api_key presente (ping no probe completo)" };
  }
  if (pay) {
    return skip(
      "asaas",
      "Asaas",
      "Cobrança habilitada no manifest sem API key — cadastre no painel (não bloqueia integration_test)",
    );
  }
  return skip("asaas", "Asaas", "cobrança desligada");
}

function conversationIdFromRow(row: Record<string, unknown>): string | null {
  const id = row.id ?? row.display_id;
  if (id == null) return null;
  return String(id);
}

/** Varredura read-only das APIs ManyTalks/Asaas conforme tools do manifest (sem writes). */
export async function probeManifestCapabilities(manifest: ManifestV1): Promise<CapabilityProbe[]> {
  const client = createManytalksClient({
    base: manifest.manytalks.base_url,
    accountId: manifest.manytalks.account_id,
    token: manifest.manytalks.api_access_token,
  });
  const results: CapabilityProbe[] = [];
  const policy = manifest.tools_policy;

  results.push(
    await probe("inboxes", "Listar inboxes", async () => {
      const raw = await client.listInboxes();
      const list = unwrapList<{ id?: number; name?: string }>(raw as never);
      return `${list.length} inbox(es)`;
    }),
  );

  const enabled = manifest.manytalks.enabled_inbox_ids ?? [];
  if (enabled.length) {
    results.push(
      await probe("enabled_inboxes", "Inboxes habilitadas no bot", async () => {
        const raw = await client.listInboxes();
        const ids = new Set(
          unwrapList<{ id?: number }>(raw as never)
            .map((i) => i.id)
            .filter((id): id is number => typeof id === "number"),
        );
        const missing = enabled.filter((id) => !ids.has(id));
        if (missing.length) throw new Error(`Inexistentes: ${missing.join(", ")}`);
        return `OK: ${enabled.join(", ")}`;
      }),
    );
  }

  if (policy.set_conversation_labels) {
    results.push(
      await probe("account_labels", "Etiquetas da account", async () => {
        const raw = await client.listAccountLabels();
        const n = unwrapList(raw).length;
        return `${n} etiqueta(s) na account`;
      }),
    );
  } else {
    results.push(skip("account_labels", "Etiquetas da account", "tool desligada"));
  }

  results.push(
    await probe("webhooks", "Listar webhooks ManyTalks", async () => {
      const raw = await client.listWebhooks();
      const list = unwrapList(raw as never);
      return `${list.length} webhook(s)`;
    }),
  );

  let sampleConvId: string | null = null;
  const inboxForSample = enabled[0];
  if (policy.send_reply || policy.set_conversation_labels) {
    results.push(
      await probe("conversations", "Listar conversas (amostra)", async () => {
        const raw = await client.listConversations({
          status: "open",
          inboxId: inboxForSample ?? null,
          page: 1,
        });
        const rows = unwrapList<Record<string, unknown>>(raw as never);
        sampleConvId = rows[0] ? conversationIdFromRow(rows[0]) : null;
        return sampleConvId
          ? `1+ conversas; amostra #${sampleConvId}`
          : "Nenhuma conversa open — leitura de detalhe omitida";
      }),
    );
  } else {
    results.push(skip("conversations", "Listar conversas", "send_reply e labels off"));
  }

  if (sampleConvId && policy.send_reply) {
    results.push(
      await probe("conversation_detail", "Detalhe da conversa", async () => {
        const conv = await client.getConversation(sampleConvId!);
        const status = String(conv.status ?? "?");
        return `status=${status}`;
      }),
    );
    results.push(
      await probe("messages_read", "Listar mensagens (read)", async () => {
        const raw = await client.getMessages(sampleConvId!);
        const n = unwrapList(raw).length;
        return `${n} mensagem(ns) na página`;
      }),
    );
  } else if (policy.send_reply) {
    results.push(skip("conversation_detail", "Detalhe da conversa", "sem conversa amostra"));
    results.push(skip("messages_read", "Listar mensagens", "sem conversa amostra"));
  }

  if (sampleConvId && policy.set_conversation_labels) {
    results.push(
      await probe("labels_read", "Etiquetas da conversa (read)", async () => {
        const raw = await client.getLabels(sampleConvId!);
        const labels = unwrapList<string>(raw);
        return labels.length ? labels.join(", ") : "(sem etiquetas)";
      }),
    );
  } else if (policy.set_conversation_labels) {
    results.push(skip("labels_read", "Etiquetas da conversa", "sem conversa amostra"));
  }

  if (policy.create_contact || policy.update_contact) {
    results.push(
      await probe("contacts_search", "Buscar contatos (read)", async () => {
        const raw = await client.searchContacts("a");
        const n = unwrapList(raw as never).length;
        return `API ok (${n} resultado(s) na amostra "a")`;
      }),
    );
  } else {
    results.push(skip("contacts_search", "Contatos", "create/update off"));
  }

  if (policy.move_kanban_card) {
    results.push(
      await probe("pipelines", "Listar pipelines kanban", async () => {
        const raw = await client.listPipelines();
        const list = unwrapList<{ id?: number; attribute_display_name?: string }>(raw as never);
        return `${list.length} pipeline(s)`;
      }),
    );
    if (manifest.kanban.pipeline_id) {
      results.push(
        await probe("pipeline_selected", "Pipeline configurado no bot", async () => {
          const raw = await client.listPipelines();
          const list = unwrapList<{ id?: number }>(raw as never);
          const pid = manifest.kanban.pipeline_id!;
          const found = list.some((p) => p.id === pid);
          if (!found) throw new Error(`Pipeline #${pid} não encontrado`);
          return `Pipeline #${pid} OK`;
        }),
      );
    }
  } else {
    results.push(skip("pipelines", "Pipelines kanban", "tool desligada"));
  }

  const asaasPrecheck = asaasProbeFromManifest(manifest);
  if (!asaasPrecheck.skipped && asaasPrecheck.ok && manifest.asaas.api_key) {
    results.push(
      await probe("asaas", "Asaas (saldo read-only)", async () => {
        const asaas = createAsaasClient(manifest.asaas.environment, manifest.asaas.api_key!);
        await asaas.ping();
        return `ambiente=${manifest.asaas.environment}`;
      }),
    );
  } else {
    results.push(asaasPrecheck);
  }

  return results;
}