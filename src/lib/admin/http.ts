import { NextResponse } from "next/server";
import { readAdminSession } from "@/lib/auth/session";

export async function adminGuard() {
  const session = await readAdminSession();
  if (!session) {
    return { session: null, error: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) };
  }
  return { session, error: null };
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
