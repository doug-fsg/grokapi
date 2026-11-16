import { NextResponse } from "next/server";
import { adminGuard, fail } from "@/lib/admin/http";
import { manytalksServiceToken } from "@/lib/env";
import { listServiceInboxes } from "@/lib/manytalks/service";

export async function GET(req: Request) {
  const { error } = await adminGuard();
  if (error) return error;
  if (!manytalksServiceToken()) {
    return fail("Configure MANYTALKS_SERVICE_TOKEN no .env.", 400);
  }
  const accountId = Number(new URL(req.url).searchParams.get("accountId"));
  if (!Number.isFinite(accountId) || accountId <= 0) {
    return fail("Informe accountId válido.", 400);
  }
  try {
    const inboxes = await listServiceInboxes(accountId);
    return NextResponse.json({ accountId, inboxes });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Falha ao listar inboxes.", 502);
  }
}
