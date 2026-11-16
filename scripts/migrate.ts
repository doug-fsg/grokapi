import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { loadEnvFile } from "../src/lib/load-env";
import { ensureDataDir, databaseUrl } from "../src/lib/env";

async function main() {
  loadEnvFile();
  ensureDataDir();
  const client = createClient({ url: databaseUrl() });
  await client.execute("PRAGMA journal_mode=WAL;");
  await client.execute("PRAGMA foreign_keys=ON;");
  const dir = path.resolve("drizzle");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const sql = readFileSync(path.join(dir, file), "utf8");
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of statements) {
      try {
        await client.execute(stmt);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        // Re-runs / SQLite quirks: coluna já existe, DROP com FK residual, etc.
        if (
          /duplicate column name/i.test(message) ||
          /already exists/i.test(message) ||
          /no such table/i.test(message) ||
          /FOREIGN KEY constraint failed/i.test(message)
        ) {
          console.log("skip stmt in", file, "—", message.slice(0, 80));
          continue;
        }
        throw err;
      }
    }
    console.log("applied", file);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
