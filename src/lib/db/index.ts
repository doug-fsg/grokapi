import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { databaseUrl } from "@/lib/env";
import { ensureDataDir } from "@/lib/env-fs";
import * as schema from "./schema";

let cached: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (cached) return cached;
  ensureDataDir();
  const client = createClient({ url: databaseUrl() });
  void client.execute("PRAGMA journal_mode=WAL;");
  void client.execute("PRAGMA busy_timeout=5000;");
  cached = drizzle(client, { schema });
  return cached;
}

export { schema };
