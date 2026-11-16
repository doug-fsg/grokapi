import { mkdirSync } from "node:fs";
import path from "node:path";

export function databaseUrl() {
  return process.env.DATABASE_URL ?? "file:./data/grokbott.sqlite";
}

export function ensureDataDir() {
  const url = databaseUrl();
  const match = url.match(/^file:(.+)$/);
  if (!match) return;
  const filePath = match[1];
  const dir = path.dirname(path.resolve(filePath));
  mkdirSync(dir, { recursive: true });
}

export function manytalksBase() {
  return (
    process.env.MANYTALKS_BASE ?? "https://app.manytalks.com.br"
  ).replace(/\/$/, "");
}

/** Platform App token — lista/provisiona accounts (`/platform/api/v1`). */
export function manytalksPlatformToken() {
  return (process.env.MANYTALKS_PLATFORM_TOKEN ?? "").trim();
}

/**
 * PAT de agente/admin com acesso às accounts que o ManyTalks Bot atende.
 * Usado como padrão quando o ManyTalks Bot não tem token próprio cifrado.
 */
export function manytalksServiceToken() {
  return (process.env.MANYTALKS_SERVICE_TOKEN ?? "").trim();
}

/** Token efetivo: override do bot → SERVICE_TOKEN do .env. */
export function resolveManytalksToken(botToken?: string | null) {
  const fromBot = (botToken ?? "").trim();
  if (fromBot) return fromBot;
  return manytalksServiceToken();
}

export function manytalksEnvStatus() {
  return {
    base: manytalksBase(),
    platformConfigured: Boolean(manytalksPlatformToken()),
    serviceConfigured: Boolean(manytalksServiceToken()),
  };
}


export function masterEncryptionKey() {
  return process.env.MASTER_ENCRYPTION_KEY ?? "";
}

/** API key do console OpenCode Zen (varredura de padrões — free cascade). */
export function openCodeApiKey() {
  return (process.env.OPENCODE_API_KEY ?? "").trim();
}

/** CSV opcional para sobrescrever a fila de modelos free. */
export function openCodeFreeModelsOverride() {
  return (process.env.OPENCODE_FREE_MODELS ?? "").trim();
}

export function sessionSecret() {
  return process.env.SESSION_SECRET ?? "dev-session-secret-change-me";
}
