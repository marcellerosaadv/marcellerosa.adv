import { ingestMessage, parseWebhook, verifySignature } from "@/lib/instagram";

export const dynamic = "force-dynamic";

/** Verificação do webhook pela Meta (hub.mode / hub.verify_token / hub.challenge). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const expected = process.env.INSTAGRAM_VERIFY_TOKEN;
  if (mode === "subscribe" && expected && token === expected && challenge) {
    return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new Response("Forbidden", { status: 403 });
}

/** Recebe mensagens do Direct, confere a assinatura e grava no CRM. */
export async function POST(req: Request) {
  const secret = process.env.META_APP_SECRET;
  if (!secret) return new Response("Webhook não configurado", { status: 500 });
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"), secret)) {
    return new Response("Assinatura inválida", { status: 401 });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("JSON inválido", { status: 400 });
  }
  const results: Record<string, number> = { created: 0, updated: 0, duplicate: 0 };
  for (const m of parseWebhook(body)) {
    results[await ingestMessage(m)]++;
  }
  // Erros de banco caem no catch do Next (500) e a Meta reenvia; mensagens repetidas são ignoradas.
  return Response.json({ ok: true, ...results });
}
