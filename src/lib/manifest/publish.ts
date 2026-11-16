import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { grokbots, grokbotsManifestSnapshots } from "@/lib/db/schema";
import { compileManifest } from "./compile";
import { nowIso } from "@/lib/utils";

export async function publishManifest(grokbotId: string) {
  const db = getDb();
  const [bot] = await db.select().from(grokbots).where(eq(grokbots.id, grokbotId)).limit(1);
  if (!bot) throw new Error("ManyTalks Bot não encontrado.");
  const nextVersion = bot.manifestVersion + 1;
  await db
    .update(grokbots)
    .set({ manifestVersion: nextVersion, updatedAt: nowIso() })
    .where(eq(grokbots.id, grokbotId));
  const manifest = await compileManifest(grokbotId, { includeSecrets: true });
  if (!manifest) throw new Error("Configuração incompleta para publicar.");
  manifest.manifest_version = nextVersion;
  await db.insert(grokbotsManifestSnapshots).values({
    id: crypto.randomUUID(),
    grokbotId,
    version: nextVersion,
    etag: manifest.etag,
    compiledJson: JSON.stringify(manifest),
    publishedAt: nowIso(),
  });
  return manifest;
}

export async function latestSnapshot(grokbotId: string) {
  const db = getDb();
  const [bot] = await db.select().from(grokbots).where(eq(grokbots.id, grokbotId)).limit(1);
  if (!bot) return null;
  const snaps = await db
    .select()
    .from(grokbotsManifestSnapshots)
    .where(eq(grokbotsManifestSnapshots.grokbotId, grokbotId));
  return snaps.sort((a, b) => b.version - a.version)[0] ?? null;
}
