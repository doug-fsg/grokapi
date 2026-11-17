export function databaseUrl() {
  return process.env.DATABASE_URL ?? "file:./data/grokbott.sqlite";
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

export function xaiApiKey() {
  return (process.env.XAI_API_KEY ?? "").trim();
}

export function xaiConfigured() {
  return Boolean(xaiApiKey());
}

/** API key do console OpenCode Zen (varredura de padrões — free cascade). */
export function openCodeApiKey() {
  return (process.env.OPENCODE_API_KEY ?? "").trim();
}

/** CSV opcional para sobrescrever a fila de modelos free. */
export function openCodeFreeModelsOverride() {
  return (process.env.OPENCODE_FREE_MODELS ?? "").trim();
}

const DEV_SESSION_FALLBACK = "dev-session-secret-change-me";

export function isProduction() {
  return process.env.NODE_ENV === "production";
}

export function sessionSecret() {
  const s = (process.env.SESSION_SECRET ?? "").trim();
  if (s) return s;
  if (isProduction()) {
    throw new Error("SESSION_SECRET obrigatório em produção.");
  }
  return DEV_SESSION_FALLBACK;
}

export function cookieSecure() {
  if (process.env.COOKIE_SECURE === "true") return true;
  if (process.env.COOKIE_SECURE === "false") return false;
  return isProduction();
}

/** Falha cedo na VPS se faltar secret/URL. */
export function assertRuntimeEnv() {
  if (!isProduction()) return;
  const missing: string[] = [];
  const need = (key: string, min = 1) => {
    const v = (process.env[key] ?? "").trim();
    if (v.length < min) missing.push(`${key} (mín. ${min} chars)`);
  };
  need("SESSION_SECRET", 16);
  need("MASTER_ENCRYPTION_KEY", 16);
  need("NEXT_PUBLIC_APP_URL", 8);
  need("MANYTALKS_SERVICE_TOKEN", 8);
  const url = (process.env.NEXT_PUBLIC_APP_URL ?? "").trim();
  if (url && !url.startsWith("https://")) {
    missing.push("NEXT_PUBLIC_APP_URL deve ser https:// em produção");
  }
  if ((process.env.SESSION_SECRET ?? "") === DEV_SESSION_FALLBACK) {
    missing.push("SESSION_SECRET não pode ser o fallback de dev");
  }
  if (missing.length) {
    throw new Error(`Ambiente de produção incompleto:\n- ${missing.join("\n- ")}`);
  }
}
