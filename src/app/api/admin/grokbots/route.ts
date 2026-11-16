import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { grokbots } from "@/lib/db/schema";
import { adminGuard, fail } from "@/lib/admin/http";
import { createGrokbot } from "@/lib/admin/grokbot-service";
import { getLatestPlaybookStatusByBot } from "@/lib/patterns/scan";

export async function GET() {
  const { error } = await adminGuard();
  if (error) return error;
  const rows = await getDb().select().from(grokbots).orderBy(desc(grokbots.updatedAt));
  const playbookByBot = await getLatestPlaybookStatusByBot(rows.map((r) => r.id));
  return NextResponse.json({
    grokbots: rows.map((r) => ({
      ...r,
      playbook: playbookByBot[r.id] ?? null,
    })),
  });
}

const createSchema = z.object({
  name: z.string().min(2),
  manytalksAccountId: z.coerce.number().int().positive(),
});

export async function POST(req: Request) {
  const { error } = await adminGuard();
  if (error) return error;
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return fail("Nome e account_id são obrigatórios.");
  try {
    const created = await createGrokbot(parsed.data);
    return NextResponse.json(created);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Falha ao criar.", 500);
  }
}
