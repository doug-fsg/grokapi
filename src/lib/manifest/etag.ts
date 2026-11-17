import type { ManifestV1 } from "@/lib/types/manifest";

export function manifestNotModified(req: Request, manifest: ManifestV1) {
  const ifNone = req.headers.get("if-none-match");
  return Boolean(ifNone && ifNone === manifest.etag);
}

export function manifestCacheHeaders(etag: string) {
  return {
    ETag: etag,
    "Cache-Control": "private, max-age=60",
  };
}