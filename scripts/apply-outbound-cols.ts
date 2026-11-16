import { createClient } from "@libsql/client";
import { loadEnvFile } from "../src/lib/load-env";
import { databaseUrl } from "../src/lib/env";
import { ensureDataDir } from "../src/lib/env-fs";

async function main() {
  loadEnvFile();
  ensureDataDir();
  const c = createClient({ url: databaseUrl() });
  const stmts = [
    "ALTER TABLE grokbots_config ADD outbound_webhook_url text",
    "ALTER TABLE grokbots_config ADD outbound_webhook_secret text",
    "ALTER TABLE grokbots_config ADD outbound_webhook_configured_at text",
  ];
  for (const s of stmts) {
    try {
      await c.execute(s);
      console.log("ok", s);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/duplicate column/i.test(msg)) console.log("skip", s);
      else throw err;
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
