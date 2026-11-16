import { NextResponse } from "next/server";
import { adminGuard, fail } from "@/lib/admin/http";
import { manytalksPlatformToken, manytalksServiceToken } from "@/lib/env";
import { listPlatformAccounts } from "@/lib/manytalks/platform";
import { getServiceProfile } from "@/lib/manytalks/service";

/**
 * Prefere SERVICE_TOKEN (profile.accounts) — funciona neste ManyTalks.
 * Fallback: PLATFORM_TOKEN se a rota /platform/.../accounts existir.
 */
export async function GET() {
  const { error } = await adminGuard();
  if (error) return error;

  if (manytalksServiceToken()) {
    try {
      const profile = await getServiceProfile();
      return NextResponse.json({
        source: "service_profile",
        profile: {
          name: profile.name,
          email: profile.email,
          role: profile.role,
        },
        accounts: profile.accounts,
      });
    } catch (err) {
      return fail(err instanceof Error ? err.message : "Falha no profile.", 502);
    }
  }

  if (manytalksPlatformToken()) {
    try {
      const accounts = await listPlatformAccounts();
      return NextResponse.json({ source: "platform", accounts });
    } catch (err) {
      return fail(
        err instanceof Error
          ? err.message
          : "Platform API não listou accounts. Use MANYTALKS_SERVICE_TOKEN.",
        502,
      );
    }
  }

  return fail(
    "Configure MANYTALKS_SERVICE_TOKEN (recomendado) ou MANYTALKS_PLATFORM_TOKEN no .env.",
    400,
  );
}
