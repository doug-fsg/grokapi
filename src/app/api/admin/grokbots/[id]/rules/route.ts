import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { stageRules } from "@/lib/db/schema";
import { adminGuard, fail } from "@/lib/admin/http";

const item = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  condition: z.string().min(1),
  targetStageId: z.string().min(1),
  addLabels: z.array(z.string()).default([]),
  priority: z.number().default(10),
  active: z.boolean().default(true),
});

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { error } = await adminGuard();
  if (error) return error;
  const { id } = await ctx.params;
  const parsed = z.object({ rules: z.array(item) }).safeParse(await req.json());
  if (!parsed.success) return fail("Regras inválidas.");
  const db = getDb();
  await db.delete(stageRules).where(eq(stageRules.grokbotId, id));
  for (const rule of parsed.data.rules) {
    await db.insert(stageRules).values({
      id: rule.id ?? crypto.randomUUID(),
      grokbotId: id,
      name: rule.name,
      condition: rule.condition,
      targetStageId: rule.targetStageId,
      addLabelsJson: JSON.stringify(rule.addLabels),
      priority: rule.priority,
      active: rule.active,
    });
  }
  return NextResponse.json({ ok: true });
}
