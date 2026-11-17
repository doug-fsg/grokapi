import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { grokbots } from "@/lib/db/schema";
import { resolveRuntimeToken } from "@/lib/library/runtime-auth";
import { loadPublishedManifest } from "@/lib/manifest/load-published";
import { manifestCacheHeaders, manifestNotModified } from "@/lib/manifest/etag";
import { rateLimitFixed } from "@/lib/rate-limit";

const MANIFEST_LIMIT = 120;
const WINDOW_MS = 60_000;

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
  const rlKey = `manifest:${tokenRow.tokenHash}`;
  if (!rateLimitFixed(rlKey, MANIFEST_LIMIT, WINDOW_MS)) {
    return NextResponse.json({ error: "rate limit — aguarde e tente de novo" }, { status: 429 });
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
  const manifest = await loadPublishedManifest(bot.id);
  if (!manifest) {
    return NextResponse.json({ error: "manifesto não publicado" }, { status: 404 });
  }
  if (manifest.schema_version !== "1.0") {
    return NextResponse.json({ error: "schema_version não suportada" }, { status: 426 });
  }
  if (manifestNotModified(req, manifest)) {
    return new NextResponse(null, {
      status: 304,
      headers: manifestCacheHeaders(manifest.etag),
    });
  }
  return NextResponse.json(manifest, {
    headers: manifestCacheHeaders(manifest.etag),
  });
}