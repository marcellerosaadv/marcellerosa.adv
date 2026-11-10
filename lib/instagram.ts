import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { getPool } from "./db/pool";
import { ensureSchema } from "./db/leads";

const GRAPH = "https://graph.instagram.com/v27.0";

/** Confere o cabeçalho X-Hub-Signature-256 (HMAC-SHA256 do corpo bruto com o App Secret). */
export function verifySignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header || !header.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const got = header.slice("sha256=".length);
  if (got.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(got, "hex"), Buffer.from(expected, "hex"));
}

type Attachment = { type?: string; payload?: { url?: string } };
type MessagingEvent = {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: { mid?: string; text?: string; is_echo?: boolean; is_deleted?: boolean; attachments?: Attachment[] };
};
type Entry = { id?: string; time?: number; messaging?: MessagingEvent[] };
type Payload = { object?: string; entry?: Entry[] };

export type ParsedMessage = {
  mid: string;
  igsid: string; // conta de quem conversa com o escritório
  direction: "in" | "out";
  text: string | null;
  attachments: Attachment[] | null;
  sentAt: Date;
};

/** Extrai as mensagens de um payload de webhook do Instagram (objeto único ou array). */
export function parseWebhook(body: unknown): ParsedMessage[] {
  const payloads: Payload[] = Array.isArray(body) ? body : [body as Payload];
  const out: ParsedMessage[] = [];
  for (const p of payloads) {
    if (!p || p.object !== "instagram" || !Array.isArray(p.entry)) continue;
    for (const entry of p.entry) {
      for (const ev of entry.messaging || []) {
        const m = ev.message;
        if (!m || !m.mid || m.is_deleted) continue;
        const echo = m.is_echo === true;
        const igsid = echo ? ev.recipient?.id : ev.sender?.id;
        if (!igsid || igsid === entry.id) continue;
        out.push({
          mid: m.mid,
          igsid,
          direction: echo ? "out" : "in",
          text: typeof m.text === "string" ? m.text : null,
          attachments: Array.isArray(m.attachments) && m.attachments.length ? m.attachments : null,
          sentAt: new Date(typeof ev.timestamp === "number" ? ev.timestamp : Date.now()),
        });
      }
    }
  }
  return out;
}

/** Busca nome e @ do remetente. Melhor esforço: se falhar, o lead é criado sem esses dados. */
async function fetchProfile(igsid: string): Promise<{ name?: string; username?: string }> {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!token) return {};
  try {
    const url = `${GRAPH}/${encodeURIComponent(igsid)}?fields=name,username&access_token=${encodeURIComponent(token)}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) return {};
    const j = (await r.json()) as { name?: string; username?: string };
    return { name: j.name || undefined, username: j.username || undefined };
  } catch {
    return {};
  }
}

function todayBR(d: Date): string {
  // Data no fuso de Brasília (AAAA-MM-DD)
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
}

function describe(m: ParsedMessage): string {
  const prefix = m.direction === "in" ? "Direct (recebida)" : "Direct (enviada)";
  const body = m.text?.trim() || (m.attachments ? `[${m.attachments.map((a) => a.type || "anexo").join(", ")}]` : "[mensagem]");
  return `${prefix}: ${body.slice(0, 1000)}`;
}

/**
 * Grava a mensagem e cria/atualiza o lead do remetente.
 * Idempotente: a Meta reenvia webhooks, e o mid repetido é ignorado.
 */
export async function ingestMessage(m: ParsedMessage): Promise<"duplicate" | "created" | "updated"> {
  await ensureSchema();
  const pool = getPool();

  // Consulta o perfil (chamada externa) antes de abrir a transação, só para contato novo.
  const known = await pool.query("SELECT 1 FROM crm_leads WHERE instagram_id = $1", [m.igsid]);
  const profile = !known.rowCount && m.direction === "in" ? await fetchProfile(m.igsid) : {};

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ins = await client.query(
      `INSERT INTO crm_instagram_messages (mid, igsid, direction, text, attachments, sent_at)
       VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (mid) DO NOTHING RETURNING mid`,
      [m.mid, m.igsid, m.direction, m.text, m.attachments ? JSON.stringify(m.attachments) : null, m.sentAt],
    );
    if (!ins.rowCount) {
      await client.query("ROLLBACK");
      return "duplicate";
    }
    const day = todayBR(m.sentAt);
    const entry = { data: day, texto: describe(m) };
    const nome = profile.name || (profile.username ? "@" + profile.username : `Instagram ${m.igsid.slice(-4)}`);
    const lead = {
      id: "IG" + randomUUID().replace(/-/g, "").slice(0, 12),
      nome,
      telefone: "",
      instagram: profile.username || "",
      instagramId: m.igsid,
      area: "SAÚDE",
      tipoAcao: "",
      origem: "INSTAGRAM",
      campanha: "Direct",
      qualificacao: "QUALIFICADO",
      etapa: "NOVO",
      dataChamado: day,
      ultimoContato: day,
      proxContato: "",
      valorFechado: 0,
      dataFechamento: "",
      objecao: "",
      comentarios: "",
      historico: [entry],
    };
    // Cria o lead ou, se o contato já existe, acrescenta a mensagem ao histórico (atômico).
    const up = await client.query(
      `INSERT INTO crm_leads (id, data, instagram_id) VALUES ($1, $2, $3)
       ON CONFLICT (instagram_id) DO UPDATE
         SET data = jsonb_set(
                      jsonb_set(crm_leads.data, '{historico}', $4::jsonb || COALESCE(crm_leads.data->'historico', '[]'::jsonb)),
                      '{ultimoContato}', to_jsonb($5::text)),
             version = crm_leads.version + 1, updated_at = now()
       RETURNING id, (xmax = 0) AS inserted`,
      [lead.id, JSON.stringify(lead), m.igsid, JSON.stringify([entry]), day],
    );
    await client.query("UPDATE crm_instagram_messages SET lead_id = $2 WHERE mid = $1", [m.mid, up.rows[0].id]);
    await client.query("COMMIT");
    return up.rows[0].inserted ? "created" : "updated";
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
