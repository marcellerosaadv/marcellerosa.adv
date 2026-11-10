import { createNeonAuth } from "@neon/auth/next/server";

type NeonAuth = ReturnType<typeof createNeonAuth>;
let instance: NeonAuth | null = null;

/** Instância única do Neon Auth (criada sob demanda para não exigir as variáveis no build). */
export function getAuth(): NeonAuth {
  if (!instance) {
    const baseUrl = process.env.NEON_AUTH_BASE_URL;
    const secret = process.env.NEON_AUTH_COOKIE_SECRET;
    if (!baseUrl) throw new Error("NEON_AUTH_BASE_URL não configurada");
    if (!secret || secret.length < 32) throw new Error("NEON_AUTH_COOKIE_SECRET ausente ou com menos de 32 caracteres");
    instance = createNeonAuth({ baseUrl, cookies: { secret } });
  }
  return instance;
}
