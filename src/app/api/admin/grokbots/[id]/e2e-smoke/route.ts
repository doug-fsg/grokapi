import { NextResponse } from "next/server";
import { adminGuard, fail } from "@/lib/admin/http";
import { runManytalksE2eSmoke } from "@/lib/admin/e2e-manytalks-smoke";
import { compileManifest } from "@/lib/manifest/compile";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { error } = await adminGuard();
  if (error) return error;
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    phone?: string;
    contact_name?: string;
    message?: string;
  };
  const manifest = await compileManifest(id, { includeSecrets: true });
  if (!manifest?.manytalks.api_access_token) {
    return fail("Token ManyTalks ausente.", 400);
  }
  const result = await runManytalksE2eSmoke(manifest, {
    phone: body.phone,
    contactName: body.contact_name,
    message: body.message,
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}