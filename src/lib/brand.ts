/**
 * Identidade de produto (visível ao operador/cliente).
 * IDs técnicos (tabelas, rotas /grokbots, headers X-Grokbot-*) permanecem estáveis.
 */
export const BRAND = {
  name: "ManyTalks Bot",
  /** Plural de UI (lista / métricas). */
  namePlural: "ManyTalks Bots",
  /** Wordmark: parte 1 + parte 2 (peso diferente). */
  wordPrimary: "ManyTalks",
  wordSecondary: "Bot",
  tagline: "Atende, cobra e publica o runtime — ManyTalks + Asaas",
  poweredBy: "Powered by ManyTalks Bot",
  packageName: "manytalks-bot-platform",
  healthService: "manytalks-bot-platform",
} as const;

export type Brand = typeof BRAND;
