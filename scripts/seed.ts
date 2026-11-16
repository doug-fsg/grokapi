import { getDb } from "../src/lib/db";
import { operators } from "../src/lib/db/schema";
import { hashPassword } from "../src/lib/auth/password";
import { nowIso } from "../src/lib/utils";
import { loadEnvFile } from "../src/lib/load-env";

async function main() {
  loadEnvFile();
  const db = getDb();
  const ts = nowIso();
  const email = process.env.ADMIN_EMAIL ?? "admin@local.test";
  const password = process.env.ADMIN_PASSWORD ?? "admin1234";
  if (process.env.NODE_ENV === "production") {
    if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
      throw new Error("ADMIN_EMAIL e ADMIN_PASSWORD obrigatórios no seed de produção.");
    }
    if (password.length < 12 || password === "admin1234") {
      throw new Error("ADMIN_PASSWORD de produção deve ter 12+ caracteres e não ser o default.");
    }
  }
  const existingOps = await db.select().from(operators).limit(1);
  if (!existingOps.length) {
    await db.insert(operators).values({
      id: crypto.randomUUID(),
      email,
      passwordHash: await hashPassword(password),
      createdAt: ts,
    });
    console.log("operator:", email);
  }
  console.log("seed ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
