import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { loadEnvFile } from "../src/lib/load-env";
import { databaseUrl } from "../src/lib/env";

loadEnvFile();

const url = databaseUrl();
const match = url.match(/^file:(.+)$/);
if (!match) {
  console.log("DATABASE_URL não é arquivo local — backup skip.");
  process.exit(0);
}

const src = path.resolve(match[1]);
if (!existsSync(src)) {
  console.error("SQLite não encontrado:", src);
  process.exit(1);
}

const dir = path.resolve("data/backups");
mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const dest = path.join(dir, `grokbott-${stamp}.sqlite`);
copyFileSync(src, dest);
console.log("backup:", dest);
