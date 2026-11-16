import { NextResponse } from "next/server";
import { adminGuard, fail } from "@/lib/admin/http";
import { saveSecrets } from "@/lib/admin/grokbot-service";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { error } = await adminGuard();
  if (error) return error;
  const { id } = await ctx.params;
  const body = (await req.json()) as {
    manytalksToken?: string;
    asaasApiKey?: string;
  };
  try {
    await saveSecrets(id, body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Falha ao cifrar.", 500);
  }
}
