import { jsonParse, nowIso } from "@/lib/utils";

export type ChecklistAck = {
  /** Mantido no manifest; no produto assume-se sempre desligado. */
  capitao_off_inboxes: boolean;
  manytalks_webhook_ok: boolean;
  manytalks_webhook_at: string | null;
  asaas_webhook_ack: boolean;
};

export const emptyChecklistAck = (): ChecklistAck => ({
  capitao_off_inboxes: true,
  manytalks_webhook_ok: false,
  manytalks_webhook_at: null,
  asaas_webhook_ack: false,
});

export function parseChecklistAck(raw: string | null | undefined): ChecklistAck {
  const parsed = jsonParse<Partial<ChecklistAck>>(raw, {});
  return {
    ...emptyChecklistAck(),
    ...parsed,
    capitao_off_inboxes: parsed.capitao_off_inboxes ?? true,
    manytalks_webhook_ok: Boolean(parsed.manytalks_webhook_ok),
    manytalks_webhook_at: parsed.manytalks_webhook_at ?? null,
    asaas_webhook_ack: Boolean(parsed.asaas_webhook_ack),
  };
}

export function mergeChecklistAck(
  currentRaw: string | null | undefined,
  patch: Partial<ChecklistAck>,
): ChecklistAck {
  return { ...parseChecklistAck(currentRaw), ...patch };
}

export function markManytalksWebhookOk(
  currentRaw: string | null | undefined,
): ChecklistAck {
  return mergeChecklistAck(currentRaw, {
    manytalks_webhook_ok: true,
    manytalks_webhook_at: nowIso(),
    capitao_off_inboxes: true,
  });
}
