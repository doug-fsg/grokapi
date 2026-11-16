import { NextResponse } from "next/server";
import { z } from "zod";
import { adminGuard, fail } from "@/lib/admin/http";
import { replaceInboxes } from "@/lib/admin/grokbot-service";

const schema = z.object({
  inboxes: z.array(
    z.object({
      inboxId: z.number(),
      inboxName: z.string().optional(),
    }),
  ),
});

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { error } = await adminGuard();
  if (error) return error;
  const { id } = await ctx.params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return fail("Lista de inboxes inválida.");
  await replaceInboxes(id, parsed.data.inboxes);
  return NextResponse.json({ ok: true });
}
