import { NextResponse } from "next/server";
import { adminGuard, fail } from "@/lib/admin/http";
import { notifyManifestPublished } from "@/lib/runtime/outbound-notify";
import { publishManifest } from "@/lib/manifest/publish";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { error } = await adminGuard();
  if (error) return error;
  const { id } = await ctx.params;
  try {
    const manifest = await publishManifest(id);
    const notify = await notifyManifestPublished(id);
    return NextResponse.json({
      manifest_version: manifest.manifest_version,
      etag: manifest.etag,
      outbound_notify: notify,
    });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Falha ao publicar.", 500);
  }
}
