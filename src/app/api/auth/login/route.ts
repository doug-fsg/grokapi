import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyPassword } from "@/lib/auth/password";
import { setAdminCookie, signAdminSession } from "@/lib/auth/session";
import { ensureAdminOperator, operatorByEmail } from "@/lib/bootstrap";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  await ensureAdminOperator();
  const body = schema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }
  const operator = await operatorByEmail(body.data.email);
  if (!operator || !(await verifyPassword(body.data.password, operator.passwordHash))) {
    return NextResponse.json({ error: "E-mail ou senha incorretos." }, { status: 401 });
  }
  const jwt = await signAdminSession(operator.id, operator.email);
  await setAdminCookie(jwt);
  return NextResponse.json({ ok: true });
}
