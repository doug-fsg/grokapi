/**
 * Smoke test da varredura de padrões — 1 conversa + cascade OpenCode.
 *
 * Uso:
 *   pnpm exec tsx scripts/test-pattern-scan.ts
 *   pnpm exec tsx scripts/test-pattern-scan.ts <grokbotId>
 */
import { eq } from "drizzle-orm";
import { loadEnvFile } from "../src/lib/load-env";
import { getDb } from "../src/lib/db";
import { grokbots, patternScans } from "../src/lib/db/schema";
import { runPatternScan, markPatternScanFailed } from "../src/lib/patterns/scan";
import { isOpenCodeCliReady } from "../src/lib/patterns/opencode-cascade";
import { nowIso } from "../src/lib/utils";

async function main() {
  loadEnvFile();
  const db = getDb();
  const grokbotId =
    process.argv[2]?.trim() || "d13d7ac6-55a5-49dd-8009-9269fca9de7d";

  const [bot] = await db.select().from(grokbots).where(eq(grokbots.id, grokbotId)).limit(1);
  if (!bot) {
    console.error("[test-pattern-scan] bot não encontrado:", grokbotId);
    process.exit(1);
  }

  const cliOk = await isOpenCodeCliReady();
  console.log("[test-pattern-scan] OpenCode CLI ready:", cliOk);
  if (!cliOk) {
    console.error(
      "[test-pattern-scan] Instale/autentique: npm i -g @opencode/cli && opencode auth login",
    );
    process.exit(1);
  }

  const scanId = crypto.randomUUID();
  const at = nowIso();
  const filters = {
    depth: "rapido" as const,
    status: "all" as const,
    inboxId: null,
    labels: [] as string[],
    maxConversations: 1,
  };

  await db.insert(patternScans).values({
    id: scanId,
    grokbotId,
    status: "pending",
    objetivoStageId: "test|1-conv",
    filtersJson: JSON.stringify(filters),
    sampledJson: JSON.stringify({ conversations: 0, messages: 0 }),
    createdAt: at,
  });

  console.log("[test-pattern-scan] start");
  console.log("  grokbot:", grokbotId);
  console.log("  account:", bot.manytalksAccountId);
  console.log("  scanId:", scanId);
  console.log("  filters:", filters);

  try {
    const result = await runPatternScan(grokbotId, scanId, filters);
    console.log("\n[test-pattern-scan] OK");
    console.log("  model:", result.model);
    console.log("  sampled:", result.sampled);
    console.log("  tone:", result.patterns.tone);
    console.log("  openings:", result.patterns.openings.slice(0, 3));
    console.log("  do:", result.patterns.do.slice(0, 3));
    process.exit(0);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await markPatternScanFailed(scanId, msg);
    console.error("\n[test-pattern-scan] FAIL:", msg);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
