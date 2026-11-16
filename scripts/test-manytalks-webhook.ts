/**
 * Diagnóstico: lista/cria webhook ManyTalks para um grokbot.
 * Uso: pnpm exec tsx scripts/test-manytalks-webhook.ts [grokbotId]
 */
import { eq } from "drizzle-orm";
import { loadEnvFile } from "../src/lib/load-env";
import { getDb } from "../src/lib/db";
import { grokbots, grokbotsSecrets } from "../src/lib/db/schema";
import { manytalksTokenFromEnc } from "../src/lib/manytalks/token";
import { appUrl } from "../src/lib/utils";
import { sameWebhookUrl } from "../src/lib/admin/register-manytalks-webhook";
import { registerManytalksWebhook } from "../src/lib/admin/register-manytalks-webhook";
import { unwrapWebhooks } from "../src/lib/manytalks/client";

function redact(s: string) {
  return s
    .replace(/api_access_token["'\s:=]+[^\s"'&,}]+/gi, "api_access_token=***")
    .replace(/Bearer\s+[^\s"']+/gi, "Bearer ***")
    .replace(/grk_live_[a-f0-9]+/gi, "grk_live_***");
}

async function raw(
  label: string,
  method: string,
  url: string,
  token: string,
  body?: unknown,
) {
  const res = await fetch(url, {
    method,
    headers: {
      api_access_token: token,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  console.log(`\n=== ${label} ===`);
  console.log(`${method} ${url.replace(/\/accounts\/\d+/, "/accounts/#")}`);
  console.log(`status: ${res.status}`);
  console.log(`body: ${redact(text).slice(0, 800)}`);
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, text, json };
}

async function main() {
  loadEnvFile();
  const grokbotId =
    process.argv[2]?.trim() || "d13d7ac6-55a5-49dd-8009-9269fca9de7d";
  const db = getDb();
  const [bot] = await db.select().from(grokbots).where(eq(grokbots.id, grokbotId)).limit(1);
  if (!bot) {
    console.error("bot não encontrado:", grokbotId);
    process.exit(1);
  }
  const [secrets] = await db
    .select()
    .from(grokbotsSecrets)
    .where(eq(grokbotsSecrets.grokbotId, grokbotId))
    .limit(1);
  const token = manytalksTokenFromEnc(secrets?.manytalksTokenEnc);
  if (!token) {
    console.error("sem token ManyTalks (bot + SERVICE_TOKEN)");
    process.exit(1);
  }

  const hookUrl = `${appUrl()}/api/hooks/manytalks`;
  const base = bot.manytalksBase.replace(/\/$/, "");
  const accountId = bot.manytalksAccountId;
  const api = `${base}/api/v1/accounts/${accountId}`;

  console.log("bot:", grokbotId);
  console.log("account:", accountId);
  console.log("base:", base);
  console.log("hookUrl:", hookUrl);
  console.log("token len:", token.length);

  const list = await raw("LIST webhooks", "GET", `${api}/webhooks`, token);
  const rows = unwrapWebhooks(list.json);
  console.log(`unwrapWebhooks count: ${rows.length}`);
  for (const row of rows) {
    const url = typeof (row as { url?: string }).url === "string" ? (row as { url: string }).url : "";
    const id = (row as { id?: unknown }).id;
    console.log(
      `  - #${id} ${url} match=${sameWebhookUrl(url, hookUrl) ? "YES" : "no"}`,
    );
  }

  const create = await raw("CREATE webhook", "POST", `${api}/webhooks`, token, {
    webhook: {
      url: hookUrl,
      subscriptions: [
        "message_created",
        "conversation_status_changed",
        "contact_kanban_stage_changed",
      ],
    },
  });

  // create sem kanban (caso subscription inválida)
  if (create.status >= 400) {
    await raw("CREATE webhook (só message_created)", "POST", `${api}/webhooks`, token, {
      webhook: {
        url: hookUrl,
        subscriptions: ["message_created"],
      },
    });
  }

  console.log("\n=== registerManytalksWebhook() ===");
  try {
    const result = await registerManytalksWebhook(grokbotId);
    console.log("OK alreadyExisted=", result.alreadyExisted, "url=", result.url);
  } catch (err) {
    console.log("FAIL:", err instanceof Error ? redact(err.message) : err);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
