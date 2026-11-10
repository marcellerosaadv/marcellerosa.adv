// Chamadas à Instagram API with Instagram Login (graph.instagram.com)
import { getSetting, setSetting } from "./db";

const HOST = "https://graph.instagram.com";
const version = () => process.env.GRAPH_API_VERSION || "v24.0";

export async function getToken(): Promise<string> {
  const stored = await getSetting("ig_token");
  const token = stored || process.env.IG_ACCESS_TOKEN;
  if (!token) throw new Error("Token do Instagram não configurado (IG_ACCESS_TOKEN)");
  return token;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${HOST}/${version()}/${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (body as { error?: { message?: string } }).error?.message || res.statusText;
    throw new Error(`Instagram API ${res.status}: ${msg}`);
  }
  return body as T;
}

type SendResult = { recipient_id: string; message_id: string };

/** Mensagem no direct (só dentro da janela de 24h após a última mensagem da pessoa). */
export function sendDirect(igAccountId: string, userId: string, text: string, quickReplies: string[] = []) {
  const message: Record<string, unknown> = { text };
  if (quickReplies.length) {
    message.quick_replies = quickReplies.map((t) => ({ content_type: "text", title: t, payload: t }));
  }
  return call<SendResult>(`${igAccountId}/messages`, {
    method: "POST",
    body: JSON.stringify({ recipient: { id: userId }, message }),
  });
}

/** Resposta privada a um comentário (até 7 dias após o comentário, uma por comentário). */
export function sendPrivateReply(igAccountId: string, commentId: string, text: string) {
  return call<SendResult>(`${igAccountId}/messages`, {
    method: "POST",
    body: JSON.stringify({ recipient: { comment_id: commentId }, message: { text } }),
  });
}

/** Resposta pública no comentário. */
export function replyToComment(commentId: string, text: string) {
  return call<{ id: string }>(`${commentId}/replies`, {
    method: "POST",
    body: JSON.stringify({ message: text }),
  });
}

/** Renova o token de longa duração (60 dias). Precisa ter mais de 24h de emitido. */
export async function refreshToken(): Promise<{ expires_in: number }> {
  const token = await getToken();
  const url = `${HOST}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  const body = (await res.json()) as { access_token?: string; expires_in?: number; error?: { message?: string } };
  if (!res.ok || !body.access_token) {
    throw new Error(`Falha ao renovar token: ${body.error?.message || res.status}`);
  }
  await setSetting("ig_token", body.access_token);
  await setSetting("ig_token_refreshed_at", new Date().toISOString());
  return { expires_in: body.expires_in ?? 0 };
}
