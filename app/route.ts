import { readFile } from "node:fs/promises";
import path from "node:path";
import { getCrmUser } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";

let html: string | null = null;

/** Página do CRM: só para usuário logado e autorizado. */
export async function GET(req: Request) {
  const user = await getCrmUser();
  if (!user) return Response.redirect(new URL("/auth/sign-in", req.url), 302);
  html ??= await readFile(path.join(process.cwd(), "crm/index.html"), "utf8");
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "same-origin",
    },
  });
}
