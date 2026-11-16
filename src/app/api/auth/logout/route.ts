import { NextResponse } from "next/server";
import { clearAdminCookie } from "@/lib/auth/session";

export async function POST() {
  await clearAdminCookie();
  return NextResponse.json({ ok: true });
}
