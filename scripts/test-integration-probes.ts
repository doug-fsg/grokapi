/**
 * Probes locais (mesma lista do "Testar integração" no admin) — sem POST no Grok.
 *
 * Uso:
 *   pnpm test:probes                    # lista bots e roda no primeiro
 *   pnpm test:probes <grokbotId>        # manifest publicado
 *   pnpm test:probes <id> --draft       # rascunho (não publicado)
 *   pnpm test:probes <id> --e2e         # probes + roteiro E2E (escrita ManyTalks)
 */
import { and, eq } from "drizzle-orm";
import { loadEnvFile } from "../src/lib/load-env";
import { getDb } from "../src/lib/db";
import { grokbots, grokbotsInboxes } from "../src/lib/db/schema";
import {
  assertManifestMatchesLocalTarget,
  integrationTestLocalTarget,
} from "../src/lib/admin/integration-test-local";
import { compileManifest } from "../src/lib/manifest/compile";
import { loadPublishedManifest } from "../src/lib/manifest/load-published";
import {
  integrationProbesOk,
  probeManifestCapabilities,
  type CapabilityProbe,
} from "../src/lib/admin/manytalks-capability-probe";
import { runManytalksE2eSmoke } from "../src/lib/admin/e2e-manytalks-smoke";

function parseArgs(argv: string[]) {
  const flags = new Set(argv.filter((a) => a.startsWith("--")));
  const positional = argv.filter((a) => !a.startsWith("--"));
  return {
    grokbotId: positional[0]?.trim() || null,
    draft: flags.has("--draft"),
    e2e: flags.has("--e2e"),
    help: flags.has("--help") || flags.has("-h"),
  };
}

function symbol(p: CapabilityProbe): string {
  if (p.skipped) return "—";
  return p.ok ? "✓" : "✗";
}

function printProbe(p: CapabilityProbe) {
  const tail = p.detail ? ` — ${p.detail}` : "";
  console.log(`${symbol(p)} ${p.name}${tail}`);
}

async function resolveGrokbotId(explicit: string | null): Promise<string> {
  const db = getDb();
  const target = integrationTestLocalTarget();

  if (explicit) return explicit;

  if (target.grokbotId) {
    console.log(`Alvo .env: grokbot ${target.grokbotId} · account ${target.accountId} · inbox ${target.inboxId}\n`);
    return target.grokbotId;
  }

  const matched = await db
    .select({
      id: grokbots.id,
      name: grokbots.name,
      manifestVersion: grokbots.manifestVersion,
    })
    .from(grokbotsInboxes)
    .innerJoin(grokbots, eq(grokbots.id, grokbotsInboxes.grokbotId))
    .where(
      and(
        eq(grokbots.manytalksAccountId, target.accountId),
        eq(grokbotsInboxes.inboxId, target.inboxId),
      ),
    )
    .limit(5);

  if (matched.length) {
    const pick =
      matched.find((r) => r.manifestVersion > 0) ?? matched[0]!;
    console.log(
      `Alvo padrão: account ${target.accountId} · inbox ${target.inboxId} → ${pick.id} (${pick.name})\n`,
    );
    return pick.id;
  }

  const rows = await db
    .select({ id: grokbots.id, name: grokbots.name, manifestVersion: grokbots.manifestVersion })
    .from(grokbots)
    .limit(20);
  if (!rows.length) {
    console.error("Nenhum ManyTalks Bot no SQLite — rode pnpm db:seed ou crie em /grokbots.");
    process.exit(1);
  }
  console.error(
    `Nenhum bot com account ${target.accountId} e inbox ${target.inboxId}. Bots no SQLite:\n`,
  );
  for (const r of rows) {
    const pub = r.manifestVersion > 0 ? `v${r.manifestVersion} publicado` : "sem publicação";
    console.error(`  ${r.id}  ${r.name} (${pub})`);
  }
  console.error(
    `\nAjuste INTEGRATION_TEST_ACCOUNT_ID / INTEGRATION_TEST_INBOX_ID no .env ou passe o grokbotId.`,
  );
  process.exit(1);
}

async function loadManifest(
  grokbotId: string,
  draft: boolean,
): Promise<{ manifest: NonNullable<Awaited<ReturnType<typeof compileManifest>>>; source: string }> {
  if (!draft) {
    const published = await loadPublishedManifest(grokbotId);
    if (published) {
      return { manifest: published, source: "manifest publicado" };
    }
    console.warn("⚠ Sem manifest publicado — usando rascunho (compile). Use --draft para forçar.\n");
  }
  const compiled = await compileManifest(grokbotId, { includeSecrets: true });
  if (!compiled) {
    console.error("Não foi possível compilar o manifest — ManyTalks/PAT incompleto?");
    process.exit(1);
  }
  return { manifest: compiled, source: draft ? "rascunho (--draft)" : "rascunho (fallback)" };
}

async function main() {
  loadEnvFile();
  const { grokbotId: idArg, draft, e2e, help } = parseArgs(process.argv.slice(2));

  if (help) {
    console.log(`Uso: pnpm test:probes [grokbotId] [--draft] [--e2e]
  Sem grokbotId: busca bot por INTEGRATION_TEST_ACCOUNT_ID / INTEGRATION_TEST_INBOX_ID (.env)
  --draft  compila config atual em vez do snapshot publicado
  --e2e    roteiro ponta a ponta (contato, label, kanban, mensagem)`);
    process.exit(0);
  }

  const grokbotId = await resolveGrokbotId(idArg);
  const [bot] = await getDb()
    .select({ name: grokbots.name })
    .from(grokbots)
    .where(eq(grokbots.id, grokbotId))
    .limit(1);

  const { manifest, source } = await loadManifest(grokbotId, draft);
  const target = integrationTestLocalTarget();

  try {
    assertManifestMatchesLocalTarget(manifest, target);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  console.log(`ManyTalks Bot: ${bot?.name ?? grokbotId}`);
  console.log(`Fonte: ${source}`);
  console.log(
    `Account ${manifest.manytalks.account_id} · inbox alvo ${target.inboxId} · habilitadas ${manifest.manytalks.enabled_inbox_ids.join(", ")}`,
  );
  console.log("\n--- Probes (read-only ManyTalks + Asaas) ---\n");

  const probes = await probeManifestCapabilities(manifest);
  for (const p of probes) printProbe(p);

  const probesOk = integrationProbesOk(probes);
  console.log(`\nprobes_ok: ${probesOk ? "sim" : "NÃO"} (skipped não contam)`);

  let exitCode = probesOk ? 0 : 1;

  if (e2e) {
    console.log("\n--- E2E (escrita ManyTalks) ---\n");
    const e2eResult = await runManytalksE2eSmoke(manifest, { inboxId: target.inboxId });
    for (const step of e2eResult.steps) {
      const mark = step.ok ? "✓" : "✗";
      const tail = step.detail ? ` — ${step.detail}` : "";
      console.log(`${mark} ${step.id}${tail}`);
    }
    console.log(`\ne2e_ok: ${e2eResult.ok ? "sim" : "NÃO"}`);
    if (!e2eResult.ok) exitCode = 1;
  } else {
    console.log("\n(dica: pnpm test:probes <id> --e2e para o roteiro completo antes de produção)");
  }

  process.exit(exitCode);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});