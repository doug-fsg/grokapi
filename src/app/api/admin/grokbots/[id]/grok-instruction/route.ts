import { NextResponse } from "next/server";
import { adminGuard, fail } from "@/lib/admin/http";
import { rotateRuntimeToken } from "@/lib/admin/grokbot-service";
import { compileManifest } from "@/lib/manifest/compile";
import { buildPasteableGrokBotSetup } from "@/lib/manifest/paste-setup";
import { appUrl } from "@/lib/utils";

/**
 * Prompt único para colar no runtime externo.
 * Sempre gera/rotaciona grk_live_ e injeta no texto (só admin).
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { error } = await adminGuard();
  if (error) return error;
  const { id } = await ctx.params;
  const manifest = await compileManifest(id, { includeSecrets: true });
  if (!manifest) return fail("Config incompleta.", 404);
  if (!manifest.manytalks.api_access_token?.trim()) {
    return fail(
      "Token ManyTalks ausente neste bot — conclua o passo ManyTalks no wizard e salve.",
      400,
    );
  }

  let runtimeToken: string;
  try {
    runtimeToken = await rotateRuntimeToken(id);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Falha ao gerar token.", 500);
  }

  const instruction = buildPasteableGrokBotSetup({ manifest, runtimeToken });

  return NextResponse.json({
    instruction,
    runtime_token: runtimeToken,
    manifest_url: `${appUrl()}/api/library/v1/manifest`,
    tools_url: `${appUrl()}/api/library/v1/tools`,
    outbound_register_url: `${appUrl()}/api/library/v1/outbound-webhook`,
    manifest_version: manifest.manifest_version,
    routine_secrets: {
      required: [{ name: "GROKBOT_RUNTIME_TOKEN", value: runtimeToken }],
      forbidden: ["MANYTALKS_API_TOKEN", "ASAAS_API_KEY", "MANYTALKS_ROUTINE_KEY"],
    },
    warning:
      "Token novo gerado nesta cópia. Tokens anteriores deste bot foram revogados na rotação.",
  });
}
