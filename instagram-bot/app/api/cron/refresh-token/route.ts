import { refreshToken } from "@/lib/instagram";
import { getSetting, log } from "@/lib/db";

export const runtime = "nodejs";

// Chamado pelo Vercel Cron (vercel.json). Renova o token a cada ~7 dias.
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const last = await getSetting("ig_token_refreshed_at");
  const days = last ? (Date.now() - new Date(last).getTime()) / 864e5 : Infinity;
  if (days < 7) return Response.json({ renovado: false, dias_desde_ultima: Math.floor(days) });
  try {
    const r = await refreshToken();
    await log("Token do Instagram renovado", { expira_em_dias: Math.floor(r.expires_in / 86400) });
    return Response.json({ renovado: true });
  } catch (e) {
    await log("Falha ao renovar token do Instagram", { erro: String(e) }, "erro");
    return Response.json({ renovado: false, erro: String(e) }, { status: 500 });
  }
}
