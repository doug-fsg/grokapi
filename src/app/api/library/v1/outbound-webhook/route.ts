import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { grokbots, grokbotsConfig } from "@/lib/db/schema";
import { resolveRuntimeToken } from "@/lib/library/runtime-auth";
import {
  isValidOutboundUrl,
  normalizeOutboundAuth,
} from "@/lib/runtime/outbound-forward";
import { writeActionLog } from "@/lib/logs/write";
import { nowIso } from "@/lib/utils";

async function loadBot(tokenGrokbotId: string) {
  const [bot] = await getDb()
    .select()
    .from(grokbots)
    .where(eq(grokbots.id, tokenGrokbotId))
    .limit(1);
  return bot ?? null;
}

export async function GET(req: Request) {
  const tokenRow = await resolveRuntimeToken(req);
  if (!tokenRow) {
    return NextResponse.json({ error: "token inválido/revogado" }, { status: 401 });
  }
  const bot = await loadBot(tokenRow.grokbotId);
  if (!bot) return NextResponse.json({ error: "token inválido/revogado" }, { status: 401 });
  const [cfg] = await getDb()
    .select({
      url: grokbotsConfig.outboundWebhookUrl,
      authHeader: grokbotsConfig.outboundWebhookAuthHeader,
      configuredAt: grokbotsConfig.outboundWebhookConfiguredAt,
      hasSecret: grokbotsConfig.outboundWebhookSecret,
    })
    .from(grokbotsConfig)
    .where(eq(grokbotsConfig.grokbotId, bot.id))
    .limit(1);
  const url = (cfg?.url ?? "").trim();
  const authHeader =
    (cfg?.authHeader ?? "").trim() ||
    ((cfg?.hasSecret ?? "").trim() ? "Authorization" : null);
  return NextResponse.json({
    configured: Boolean(url),
    url: url || null,
    auth_header: authHeader,
    has_auth_value: Boolean((cfg?.hasSecret ?? "").trim()),
    configured_at: cfg?.configuredAt ?? null,
    grokbot_id: bot.id,
  });
}

export async function PUT(req: Request) {
  const tokenRow = await resolveRuntimeToken(req);
  if (!tokenRow) {
    return NextResponse.json({ error: "token inválido/revogado" }, { status: 401 });
  }
  const bot = await loadBot(tokenRow.grokbotId);
  if (!bot) return NextResponse.json({ error: "token inválido/revogado" }, { status: 401 });
  if (!bot.enabled) {
    return NextResponse.json({ error: "grokbot desabilitado" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    url?: string;
    secret?: string | null;
    auth_value?: string | null;
    auth_header?: string | null;
  };
  const url = String(body.url ?? "").trim();
  if (!url || !isValidOutboundUrl(url)) {
    return NextResponse.json(
      { error: "url inválida — use http(s)://..." },
      { status: 400 },
    );
  }

  const authValueRaw = body.auth_value ?? body.secret;
  const authValueIn =
    authValueRaw === null || authValueRaw === undefined
      ? null
      : String(authValueRaw).trim() || null;
  const authHeaderIn =
    body.auth_header === null || body.auth_header === undefined
      ? null
      : String(body.auth_header).trim() || null;

  const { authHeader, authValue } = normalizeOutboundAuth(
    authHeaderIn ?? (authValueIn ? "Authorization" : null),
    authValueIn,
  );

  const at = nowIso();

  await getDb()
    .update(grokbotsConfig)
    .set({
      outboundWebhookUrl: url,
      outboundWebhookSecret: authValue,
      outboundWebhookAuthHeader: authHeader,
      outboundWebhookConfiguredAt: at,
    })
    .where(eq(grokbotsConfig.grokbotId, bot.id));

  await getDb()
    .update(grokbots)
    .set({ lastError: null, updatedAt: at })
    .where(eq(grokbots.id, bot.id));

  await writeActionLog({
    grokbotId: bot.id,
    conversationId: null,
    kind: "outbound_webhook_registered",
    payload: { url_host: safeHost(url), auth_header: authHeader, at },
  });

  return NextResponse.json({
    configured: true,
    url,
    auth_header: authHeader,
    has_auth_value: Boolean(authValue),
    configured_at: at,
    grokbot_id: bot.id,
    message:
      "Webhook de saída registrado. O relay enviará o envelope com o cabeçalho de auth configurado.",
  });
}

export async function DELETE(req: Request) {
  const tokenRow = await resolveRuntimeToken(req);
  if (!tokenRow) {
    return NextResponse.json({ error: "token inválido/revogado" }, { status: 401 });
  }
  const bot = await loadBot(tokenRow.grokbotId);
  if (!bot) return NextResponse.json({ error: "token inválido/revogado" }, { status: 401 });

  await getDb()
    .update(grokbotsConfig)
    .set({
      outboundWebhookUrl: null,
      outboundWebhookSecret: null,
      outboundWebhookAuthHeader: null,
      outboundWebhookConfiguredAt: null,
    })
    .where(eq(grokbotsConfig.grokbotId, bot.id));

  await writeActionLog({
    grokbotId: bot.id,
    conversationId: null,
    kind: "outbound_webhook_cleared",
    payload: { at: nowIso() },
  });

  return NextResponse.json({
    configured: false,
    url: null,
    grokbot_id: bot.id,
    message: "Webhook de saída removido. Mensagens ficarão em skip até registrar nova URL.",
  });
}

function safeHost(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return "(invalid)";
  }
}
