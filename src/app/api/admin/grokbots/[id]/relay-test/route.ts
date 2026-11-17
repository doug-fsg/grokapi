import { NextResponse } from "next/server";
import { adminGuard, fail } from "@/lib/admin/http";
import { runRelayIntegrationTest } from "@/lib/runtime/outbound-notify";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { error } = await adminGuard();
  if (error) return error;
  const { id } = await ctx.params;
  try {
    const report = await runRelayIntegrationTest(id, { trigger: "manual" });
    return NextResponse.json(report, { status: report.all_ok ? 200 : 502 });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Falha no teste.", 400);
  }
}