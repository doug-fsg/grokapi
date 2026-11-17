import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { grokbots } from "@/lib/db/schema";
import { resolveRuntimeToken } from "@/lib/library/runtime-auth";
import { loadPublishedManifest } from "@/lib/manifest/load-published";
import { ManytalksSendErrorException } from "@/lib/manytalks/send-errors";
import { toolRequiresConversationId } from "@/lib/runtime/tool-context";
import { executeTool } from "@/lib/runtime/tool-exec";

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
  const manifest = await loadPublishedManifest(bot.id);
  if (!manifest) {
    return NextResponse.json({ error: "manifesto não publicado" }, { status: 404 });
  }
  const body = (await req.json()) as {
    name?: string;
    arguments?: Record<string, unknown>;
    conversation_id?: string | number;
    contact_id?: number;
  };
  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "name obrigatório" }, { status: 400 });
  const conversationId = body.conversation_id;
  if (toolRequiresConversationId(name)) {
    if (conversationId == null || conversationId === "") {
      return NextResponse.json({ error: "conversation_id obrigatório para esta tool" }, { status: 400 });
    }
  }
  const convCtx =
    conversationId != null && conversationId !== ""
      ? String(conversationId)
      : "__no_conversation__";
  try {
    const result = await executeTool(
      manifest,
      { conversationId: convCtx, contactId: body.contact_id },
      name,
      body.arguments ?? {},
    );
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    if (err instanceof ManytalksSendErrorException) {
      return NextResponse.json(
        { ok: false, error: err.structured.message, manytalks: err.structured },
        { status: 422 },
      );
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}