import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { grokbots } from "@/lib/db/schema";
import { resolveRuntimeToken } from "@/lib/library/runtime-auth";
import { emitDomainEvent } from "@/lib/runtime/domain-events";

export async function POST(req: Request) {
  const tokenRow = await resolveRuntimeToken(req);
  if (!tokenRow) {
    return NextResponse.json({ error: "token inválido/revogado" }, { status: 401 });
  }
  const [bot] = await getDb()
    .select()
    .from(grokbots)
    .where(eq(grokbots.id, tokenRow.grokbotId))
    .limit(1);
  if (!bot?.enabled) {
    return NextResponse.json({ error: "grokbot desabilitado" }, { status: 403 });
  }
  const body = (await req.json()) as {
    type?: string;
    payload?: Record<string, unknown>;
  };
  const type = String(body.type ?? "").trim();
  if (!type || type.length > 80) {
    return NextResponse.json({ error: "type inválido" }, { status: 400 });
  }
  const payload = body.payload && typeof body.payload === "object" ? body.payload : {};
  await emitDomainEvent(bot.id, type, payload);
  return NextResponse.json({ ok: true });
}