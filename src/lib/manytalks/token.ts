import { decryptSecret } from "@/lib/crypto";
import { resolveManytalksToken } from "@/lib/env";

/** Resolve token do bot (cifrado) ou cai no MANYTALKS_SERVICE_TOKEN do .env. */
export function manytalksTokenFromEnc(enc: string | null | undefined) {
  const bot = enc ? decryptSecret(enc) : "";
  return resolveManytalksToken(bot);
}
