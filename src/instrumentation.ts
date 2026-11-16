export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { assertRuntimeEnv } = await import("@/lib/env");
  assertRuntimeEnv();
}
