import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { grokbots } from "@/lib/db/schema";
import { adminGuard, fail } from "@/lib/admin/http";
import { cancelPatternScans } from "@/lib/patterns/cancel";
import { writeActionLog } from "@/lib/logs/write";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { error } = await adminGuard();
  if (error) return error;
  const { id } = await ctx.params;
  const [bot] = await getDb().select().from(grokbots).where(eq(grokbots.id, id)).limit(1);
  if (!bot) return fail("Não encontrado.", 404);

  const body = (await req.json().catch(() => ({}))) as { scanId?: string };
  const result = await cancelPatternScans({
    grokbotId: id,
    scanId: body.scanId,
    reason: "Cancelado pelo operador",
  });

  await writeActionLog({
    grokbotId: id,
    kind: "playbook_scan_cancelled",
    payload: result,
  });

  return NextResponse.json({ ok: true, ...result });
}
