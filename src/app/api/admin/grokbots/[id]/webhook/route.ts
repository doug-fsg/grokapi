import { NextResponse } from "next/server";
import { adminGuard, fail } from "@/lib/admin/http";
import { registerManytalksWebhook } from "@/lib/admin/register-manytalks-webhook";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { error } = await adminGuard();
  if (error) return error;
  const { id } = await ctx.params;
  try {
    const result = await registerManytalksWebhook(id);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao registrar webhook.";
    const status = message.includes("não encontrado")
      ? 404
      : message.includes("ausente")
        ? 400
        : 502;
    return fail(message, status);
  }
}
