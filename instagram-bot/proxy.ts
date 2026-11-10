import { NextResponse, type NextRequest } from "next/server";

// Protege o painel com usuário e senha (Basic Auth). Webhook e cron ficam de fora.
export function proxy(req: NextRequest) {
  const user = process.env.ADMIN_USER || "admin";
  const pass = process.env.ADMIN_PASSWORD;
  if (!pass) return new NextResponse("Defina ADMIN_PASSWORD nas variáveis de ambiente.", { status: 500 });

  const header = req.headers.get("authorization") || "";
  if (header.startsWith("Basic ")) {
    const [u, ...rest] = atob(header.slice(6)).split(":");
    if (u === user && rest.join(":") === pass) return NextResponse.next();
  }
  return new NextResponse("Acesso restrito", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Painel Instagram", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/((?!api/webhook|api/cron|_next/static|_next/image|favicon.ico).*)"],
};
