import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { grokbots } from "@/lib/db/schema";
import { resolveRuntimeToken } from "@/lib/library/runtime-auth";
import { compileManifest } from "@/lib/manifest/compile";
import { latestSnapshot } from "@/lib/manifest/publish";
import { jsonParse } from "@/lib/utils";
import type { ManifestV1 } from "@/lib/types/manifest";

async function loadManifest(grokbotId: string) {
  const snap = await latestSnapshot(grokbotId);
  if (snap) return jsonParse<ManifestV1>(snap.compiledJson, null as unknown as ManifestV1);
  return compileManifest(grokbotId, { includeSecrets: true });
}

export async function HEAD(req: Request) {
  const token = await resolveRuntimeToken(req);
  if (!token) return new NextResponse(null, { status: 401 });
  return new NextResponse(null, { status: 200 });
}

export async function GET(req: Request) {
  const tokenRow = await resolveRuntimeToken(req);
  if (!tokenRow) {
    return NextResponse.json({ error: "token inválido/revogado" }, { status: 401 });
  }
  const [bot] = await getDb()
    .select()
    .from(grokbots)
    .where(eq(grokbots.id, tokenRow.grokbotId))
    .limit(1);
  if (!bot) return NextResponse.json({ error: "token inválido/revogado" }, { status: 401 });
  if (!bot.enabled) {
    return NextResponse.json({ error: "grokbot desabilitado" }, { status: 403 });
  }
  const manifest = await loadManifest(bot.id);
  if (!manifest) {
    return NextResponse.json({ error: "manifesto não publicado" }, { status: 404 });
  }
  if (manifest.schema_version !== "1.0") {
    return NextResponse.json({ error: "schema_version não suportada" }, { status: 426 });
  }
  const ifNone = req.headers.get("if-none-match");
  if (ifNone && ifNone === manifest.etag) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        ETag: manifest.etag,
        "Cache-Control": "private, max-age=60",
      },
    });
  }
  return NextResponse.json(manifest, {
    headers: {
      ETag: manifest.etag,
      "Cache-Control": "private, max-age=60",
    },
  });
}
