import { mkdirSync } from "node:fs";
import path from "node:path";
import { databaseUrl } from "@/lib/env";

/** Só Node (worker, migrate, db). Não importar em client/middleware. */
export function ensureDataDir() {
  const url = databaseUrl();
  const match = url.match(/^file:(.+)$/);
  if (!match) return;
  const dir = path.dirname(path.resolve(match[1]));
  mkdirSync(dir, { recursive: true });
}
