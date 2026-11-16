import { NextResponse } from "next/server";
import { adminGuard, fail } from "@/lib/admin/http";
import { compileManifest } from "@/lib/manifest/compile";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { error } = await adminGuard();
  if (error) return error;
  const { id } = await ctx.params;
  const manifest = await compileManifest(id, { includeSecrets: false });
  if (!manifest) return fail("Config incompleta.", 404);
  return NextResponse.json(manifest);
}
