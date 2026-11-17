/** Alvo fixo do `pnpm test:probes` (pré-produção). Sobrescreva via .env */
export type IntegrationTestLocalTarget = {
  accountId: number;
  inboxId: number;
  grokbotId: string | null;
};

function envInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export function integrationTestLocalTarget(): IntegrationTestLocalTarget {
  return {
    accountId: envInt("INTEGRATION_TEST_ACCOUNT_ID", 41),
    inboxId: envInt("INTEGRATION_TEST_INBOX_ID", 571),
    grokbotId: process.env.INTEGRATION_TEST_GROKBOT_ID?.trim() || null,
  };
}

export function assertManifestMatchesLocalTarget(
  manifest: { manytalks: { account_id: number; enabled_inbox_ids: number[] } },
  target: IntegrationTestLocalTarget,
): void {
  if (manifest.manytalks.account_id !== target.accountId) {
    throw new Error(
      `Manifest account ${manifest.manytalks.account_id} ≠ INTEGRATION_TEST_ACCOUNT_ID=${target.accountId}`,
    );
  }
  if (!manifest.manytalks.enabled_inbox_ids.includes(target.inboxId)) {
    throw new Error(
      `Inbox ${target.inboxId} não está habilitada no bot (atual: ${manifest.manytalks.enabled_inbox_ids.join(", ")}). ` +
        `Ajuste INTEGRATION_TEST_INBOX_ID ou o bot no painel.`,
    );
  }
}