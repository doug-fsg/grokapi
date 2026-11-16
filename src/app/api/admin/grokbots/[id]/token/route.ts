import { NextResponse } from "next/server";
import { adminGuard, fail } from "@/lib/admin/http";
import { rotateRuntimeToken } from "@/lib/admin/grokbot-service";
import { appUrl } from "@/lib/utils";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { error } = await adminGuard();
  if (error) return error;
  const { id } = await ctx.params;
  try {
    const token = await rotateRuntimeToken(id);
    return NextResponse.json({
      runtime_token: token,
      manifest_url: `${appUrl()}/api/library/v1/manifest`,
    });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Falha.", 500);
  }
}
