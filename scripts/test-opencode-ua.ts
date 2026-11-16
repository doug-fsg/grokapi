import { loadEnvFile } from "../src/lib/load-env";
import { openCodeApiKey } from "../src/lib/env";

async function tryOnce(label: string, headers: Record<string, string>, model: string) {
  const res = await fetch("https://opencode.ai/inference/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: "Responda só: ok" }],
      max_tokens: 16,
    }),
  });
  const text = await res.text();
  console.log(`\n[${label}] HTTP ${res.status}`);
  console.log(text.slice(0, 280));
}

async function main() {
  loadEnvFile();
  const key = openCodeApiKey();
  if (!key) {
    console.log("sem key");
    process.exit(1);
  }
  const model = "big-pickle";
  await tryOnce("ua+key", {
    Authorization: `Bearer ${key}`,
    "User-Agent": "opencode/1.1.0",
  }, model);
  await tryOnce("ua+public", {
    Authorization: "Bearer public",
    "User-Agent": "opencode/1.1.0",
  }, model);
  await tryOnce("zen-ua+key", {
    Authorization: `Bearer ${key}`,
    "User-Agent": "opencode/1.1.0",
  }, model);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
