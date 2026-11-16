import { NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin/http";
import { manytalksEnvStatus, manytalksServiceToken } from "@/lib/env";
import { getServiceProfile } from "@/lib/manytalks/service";

export async function GET() {
  const { error } = await adminGuard();
  if (error) return error;
  const status = manytalksEnvStatus();
  if (!manytalksServiceToken()) {
    return NextResponse.json({ ...status, profile: null, accountsCount: 0 });
  }
  try {
    const profile = await getServiceProfile();
    return NextResponse.json({
      ...status,
      profile: {
        name: profile.name,
        email: profile.email,
        role: profile.role,
      },
      accountsCount: profile.accounts.length,
    });
  } catch (err) {
    return NextResponse.json({
      ...status,
      profile: null,
      accountsCount: 0,
      profileError: err instanceof Error ? err.message : "Erro no profile",
    });
  }
}
