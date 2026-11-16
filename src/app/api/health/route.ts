import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { operators } from "@/lib/db/schema";

export async function GET() {
  try {
    await getDb().select({ id: operators.id }).from(operators).limit(1);
    return NextResponse.json({
      ok: true,
      service: "manytalks-bot-platform",
      env: process.env.NODE_ENV ?? "development",
    });
  } catch {
    return NextResponse.json(
      { ok: false, service: "manytalks-bot-platform", error: "db" },
      { status: 503 },
    );
  }
}
