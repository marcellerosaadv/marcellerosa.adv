import { getAuth } from "./server";

export type CrmUser = { id: string; email: string; name?: string | null };

/** E-mails autorizados (ALLOWED_EMAILS, separados por vírgula). Lista vazia = ninguém entra. */
export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowed = (process.env.ALLOWED_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}

/**
 * Retorna o usuário logado e autorizado, ou null.
 * Teste local (fora da Vercel): CRM_LOCAL_TEST_USER simula um usuário. Ignorado na Vercel.
 */
export async function getCrmUser(): Promise<CrmUser | null> {
  const localTest = process.env.CRM_LOCAL_TEST_USER;
  if (localTest && !process.env.VERCEL) {
    return isAllowedEmail(localTest) ? { id: "local-test", email: localTest } : null;
  }
  const { data: session } = await getAuth().getSession();
  const user = session?.user;
  if (!user || !isAllowedEmail(user.email)) return null;
  return { id: user.id, email: user.email, name: user.name };
}

export function unauthorized() {
  return Response.json({ error: "Não autorizado" }, { status: 401 });
}
