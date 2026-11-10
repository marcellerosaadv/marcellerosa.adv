import { after } from "next/server";
import { verifySignature } from "@/lib/signature";
import { processPayload } from "@/lib/engine";
import { log } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 60;

// Verificação do webhook no painel da Meta
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token && token === process.env.META_VERIFY_TOKEN) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

// Eventos (comentários e mensagens)
export async function POST(req: Request) {
  const raw = await req.text();
  const ok = verifySignature(raw, req.headers.get("x-hub-signature-256"), process.env.META_APP_SECRET || "");
  if (!ok) {
    after(() => log("Webhook com assinatura inválida rejeitado", undefined, "erro"));
    return new Response("Invalid signature", { status: 401 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }
  // responde 200 na hora para a Meta e processa em seguida
  after(() => processPayload(payload));
  return new Response("EVENT_RECEIVED", { status: 200 });
}
