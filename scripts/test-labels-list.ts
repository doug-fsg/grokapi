import { loadEnvFile } from "../src/lib/load-env";
import { createManytalksClient } from "../src/lib/manytalks/client";
import { unwrapLabelTitles } from "../src/lib/manytalks/labels";
import { manytalksBase, manytalksServiceToken } from "../src/lib/env";

async function main() {
  loadEnvFile();
  const token = manytalksServiceToken();
  if (!token) throw new Error("sem SERVICE_TOKEN");
  const client = createManytalksClient({
    base: manytalksBase(),
    accountId: 41,
    token,
  });
  const raw = await client.listAccountLabels();
  const titles = unwrapLabelTitles(raw);
  console.log("raw keys:", raw && typeof raw === "object" ? Object.keys(raw as object) : typeof raw);
  console.log("count:", titles.length);
  console.log("sample:", titles.slice(0, 20).join(", ") || "(vazio)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
