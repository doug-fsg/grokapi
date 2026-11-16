import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { grokbotsConfig } from "@/lib/db/schema";
import { writeActionLog } from "@/lib/logs/write";
import { nowIso } from "@/lib/utils";

export type OutboundEnvelope = {
  schema_version: "1.0";
  event: "message_created";
  grokbot_id: string;
  manytalks: {
    account_id: number;
    conversation_id: string;
    inbox_id: number;
    contact_id: number | null;
    contact_name: string | null;
    status: string;
    message_id: string;
    from: "client" | "agent";
    content: string;
  };
  labels: string[];
  received_at: string;
};

/** Envelope genérico (message_created, playbook_patterns, …). */
export type OutboundPayload = {
  schema_version: "1.0";
  event: string;
  grokbot_id: string;
  received_at: string;
  [key: string]: unknown;
};

export type OutboundWebhookConfig = {
  url: string;
  /** Valor do header de autenticação (chave do painel da rotina). */
  authValue: string | null;
  /** Nome do header, ex. Authorization. Default Authorization se houver valor. */
  authHeader: string | null;
  configuredAt: string | null;
};

/**
 * Normaliza colagem do painel Cursor:
 * - "Authorization: Bearer …" no nome → separa nome/valor
 * - chave crsr_… sem Bearer → prefixa Bearer
 */
export function normalizeOutboundAuth(
  header: string | null | undefined,
  value: string | null | undefined,
): { authHeader: string | null; authValue: string | null } {
  let h = String(header ?? "").trim();
  let v = String(value ?? "").trim();

  if (h.includes(":")) {
    const colon = h.indexOf(":");
    const name = h.slice(0, colon).trim();
    const rest = h.slice(colon + 1).trim();
    h = name || "Authorization";
    if (!v && rest) v = rest;
  }

  if (!h && v) h = "Authorization";
  if (!h) return { authHeader: null, authValue: v || null };
  if (!isValidAuthHeaderName(h)) {
    // fallback seguro se ainda vier lixo
    h = "Authorization";
  }
  if (!v) return { authHeader: h, authValue: null };

  if (/^authorization$/i.test(h) && !/^(Bearer|Basic|Digest)\s/i.test(v)) {
    v = `Bearer ${v}`;
  }
  return { authHeader: h, authValue: v };
}

export async function getOutboundWebhook(grokbotId: string): Promise<OutboundWebhookConfig | null> {
  const [cfg] = await getDb()
    .select({
      url: grokbotsConfig.outboundWebhookUrl,
      secret: grokbotsConfig.outboundWebhookSecret,
      authHeader: grokbotsConfig.outboundWebhookAuthHeader,
      configuredAt: grokbotsConfig.outboundWebhookConfiguredAt,
    })
    .from(grokbotsConfig)
    .where(eq(grokbotsConfig.grokbotId, grokbotId))
    .limit(1);
  const url = (cfg?.url ?? "").trim();
  if (!url) return null;
  const { authHeader, authValue } = normalizeOutboundAuth(cfg?.authHeader, cfg?.secret);
  return {
    url,
    authValue,
    authHeader,
    configuredAt: cfg?.configuredAt ?? null,
  };
}

export function buildOutboundForwardHeaders(input: {
  grokbotId: string;
  authHeader: string | null;
  authValue: string | null;
}): Record<string, string> {
  const { authHeader, authValue } = normalizeOutboundAuth(input.authHeader, input.authValue);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-Grokbot-Id": input.grokbotId,
  };
  if (authHeader && authValue) {
    headers[authHeader] = authValue;
  }
  return headers;
}

export async function forwardToOutboundWebhook(input: {
  grokbotId: string;
  url: string;
  authHeader: string | null;
  authValue: string | null;
  envelope: OutboundEnvelope | OutboundPayload;
}): Promise<{ ok: boolean; status: number; error?: string }> {
  const { authHeader, authValue } = normalizeOutboundAuth(input.authHeader, input.authValue);
  const headers = buildOutboundForwardHeaders({
    grokbotId: input.grokbotId,
    authHeader,
    authValue,
  });

  const manytalks =
    "manytalks" in input.envelope && input.envelope.manytalks
      ? (input.envelope.manytalks as OutboundEnvelope["manytalks"])
      : null;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch(input.url, {
      method: "POST",
      headers,
      body: JSON.stringify(input.envelope),
      signal: ctrl.signal,
    });
    const ok = res.ok;
    const errText = ok ? undefined : `HTTP ${res.status}`;
    await writeActionLog({
      grokbotId: input.grokbotId,
      conversationId: manytalks?.conversation_id ?? null,
      kind: ok ? "forward:outbound" : "forward_error:outbound",
      payload: {
        status: res.status,
        url_host: safeHost(input.url),
        auth_header: authHeader,
        event: input.envelope.event,
        message_id: manytalks?.message_id,
        inbox_id: manytalks?.inbox_id,
      },
    });
    return { ok, status: res.status, error: errText };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const short =
      /abort/i.test(message)
        ? "timeout"
        : /invalid header name/i.test(message)
          ? "cabeçalho inválido — use só o nome (Authorization) e a chave no campo chave"
          : message.slice(0, 160);
    await writeActionLog({
      grokbotId: input.grokbotId,
      conversationId: manytalks?.conversation_id ?? null,
      kind: "forward_error:outbound",
      payload: {
        error: message,
        url_host: safeHost(input.url),
        event: input.envelope.event,
        at: nowIso(),
      },
    });
    return { ok: false, status: 0, error: short };
  } finally {
    clearTimeout(timer);
  }
}

function safeHost(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return "(invalid)";
  }
}

export function isValidOutboundUrl(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export function isValidAuthHeaderName(name: string) {
  return /^[A-Za-z0-9-]+$/.test(name) && name.length <= 64;
}
