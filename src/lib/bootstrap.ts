import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { operators } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { nowIso } from "@/lib/utils";

export async function ensureAdminOperator() {
  const db = getDb();
  const existing = await db.select().from(operators).limit(1);
  if (existing.length) return;
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;
  if (process.env.NODE_ENV === "production" && (password.length < 12 || password === "admin1234")) {
    throw new Error("ADMIN_PASSWORD de produção inválido (12+ chars, não use o default).");
  }
  await db.insert(operators).values({
    id: crypto.randomUUID(),
    email,
    passwordHash: await hashPassword(password),
    createdAt: nowIso(),
  });
}

export async function operatorByEmail(email: string) {
  const [row] = await getDb()
    .select()
    .from(operators)
    .where(eq(operators.email, email))
    .limit(1);
  return row ?? null;
}
