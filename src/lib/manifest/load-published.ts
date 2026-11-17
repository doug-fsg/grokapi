import { jsonParse } from "@/lib/utils";
import type { ManifestV1 } from "@/lib/types/manifest";
import { latestSnapshot } from "./publish";

/** Manifesto da última publicação — não compila config ao vivo. */
export async function loadPublishedManifest(grokbotId: string): Promise<ManifestV1 | null> {
  const snap = await latestSnapshot(grokbotId);
  if (!snap) return null;
  return jsonParse<ManifestV1>(snap.compiledJson, null as unknown as ManifestV1);
}