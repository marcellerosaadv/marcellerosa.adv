// Motor: recebe o payload do webhook e decide o que responder.
import { q, getSetting, log } from "./db";
import { pickRule, matchKeyword, extractEmail, extractPhone, quickReplyTitles, type Rule } from "./rules";
import { sendDirect, sendPrivateReply, replyToComment } from "./instagram";

type Automation = Rule & {
  name: string;
  dm_text: string;
  public_reply: string | null;
  quick_replies: string | null;
};

type CommentValue = {
  id: string;
  text?: string;
  from?: { id: string; username?: string };
  media?: { id?: string };
  parent_id?: string;
};

type MessagingEvent = {
  sender: { id: string };
  recipient: { id: string };
  timestamp?: number;
  message?: {
    mid: string;
    text?: string;
    is_echo?: boolean;
    is_self?: boolean;
    is_deleted?: boolean;
    quick_reply?: { payload: string };
  };
  postback?: { payload?: string; title?: string };
};

type Entry = {
  id: string;
  time?: number;
  field?: string;
  value?: CommentValue;
  changes?: { field: string; value: CommentValue }[];
  messaging?: MessagingEvent[];
};

const HUMAN_PAUSE_HOURS = Number(process.env.HUMAN_PAUSE_HOURS || 24);
const FALLBACK_COOLDOWN_HOURS = 12;

async function loadAutomations(): Promise<Automation[]> {
  return q<Automation>("SELECT * FROM automations WHERE active = true");
}

async function withNotice(userId: string, text: string): Promise<{ text: string; addedNotice: boolean }> {
  const notice = await getSetting("aviso_privacidade");
  if (!notice) return { text, addedNotice: false };
  const rows = await q<{ notice_sent: boolean }>("SELECT notice_sent FROM contacts WHERE ig_user_id = $1", [userId]);
  if (rows[0]?.notice_sent) return { text, addedNotice: false };
  return { text: `${text}\n\n${notice}`, addedNotice: true };
}

async function upsertContact(userId: string, fields: { username?: string; origin?: string; inbound?: boolean }) {
  await q(
    `INSERT INTO contacts (ig_user_id, username, origin, last_inbound_at)
     VALUES ($1, $2, $3, CASE WHEN $4 THEN now() ELSE NULL END)
     ON CONFLICT (ig_user_id) DO UPDATE SET
       username = COALESCE(EXCLUDED.username, contacts.username),
       origin = COALESCE(contacts.origin, EXCLUDED.origin),
       last_inbound_at = CASE WHEN $4 THEN now() ELSE contacts.last_inbound_at END`,
    [userId, fields.username ?? null, fields.origin ?? null, !!fields.inbound],
  );
}

async function recordOutbound(userId: string, text: string, mid: string | undefined, addedNotice: boolean) {
  await q(
    "INSERT INTO messages (ig_user_id, direction, text, mid) VALUES ($1, 'out_bot', $2, $3) ON CONFLICT (mid) DO NOTHING",
    [userId, text, mid ?? null],
  );
  await q(
    `UPDATE contacts SET last_auto_at = now(), notice_sent = notice_sent OR $2 WHERE ig_user_id = $1`,
    [userId, addedNotice],
  );
}

async function bumpHits(id: number) {
  await q("UPDATE automations SET hits = hits + 1 WHERE id = $1", [id]);
}

// ---------- Comentários ----------
async function handleComment(igAccountId: string, c: CommentValue) {
  if (!c?.id || !c.from?.id || !c.text) return;
  if (c.from.id === igAccountId) return; // comentário da própria conta (inclui as respostas do bot)

  const rule = pickRule(await loadAutomations(), "comment", c.text, c.media?.id ?? null);
  if (!rule) return;

  // trava de duplicidade: a Meta pode reenviar o mesmo evento
  const claimed = await q(
    `INSERT INTO processed_comments (comment_id, ig_user_id, automation_id) VALUES ($1, $2, $3)
     ON CONFLICT (comment_id) DO NOTHING RETURNING comment_id`,
    [c.id, c.from.id, rule.id],
  );
  if (!claimed.length) return;

  const userId = c.from.id;
  await upsertContact(userId, { username: c.from.username, origin: `comentario:${rule.name}` });
  await q("INSERT INTO messages (ig_user_id, direction, text) VALUES ($1, 'in', $2)", [userId, `[comentário] ${c.text}`]);

  const { text, addedNotice } = await withNotice(userId, rule.dm_text);
  try {
    const sent = await sendPrivateReply(igAccountId, c.id, text);
    await recordOutbound(userId, text, sent.message_id, addedNotice);
  } catch (e) {
    await log("Falha na resposta privada ao comentário", { comment: c.id, erro: String(e) }, "erro");
  }

  if (rule.public_reply) {
    try {
      await replyToComment(c.id, rule.public_reply);
    } catch (e) {
      await log("Falha na resposta pública ao comentário", { comment: c.id, erro: String(e) }, "erro");
    }
  }
  await bumpHits(rule.id);
}

// ---------- Direct ----------
async function handleMessaging(igAccountId: string, ev: MessagingEvent) {
  const msg = ev.message;
  const text = msg?.quick_reply?.payload || ev.postback?.payload || msg?.text;

  // Eco: mensagem que saiu da conta. Se não foi o bot, foi atendimento humano: pausa o bot.
  if (msg?.is_echo) {
    if (msg.is_self) return;
    const userId = ev.recipient.id;
    const mine = await q("SELECT 1 FROM messages WHERE mid = $1", [msg.mid]);
    if (mine.length) return;
    // dá uma pequena folga para o registro do envio do próprio bot
    await new Promise((r) => setTimeout(r, 1500));
    const mineLater = await q("SELECT 1 FROM messages WHERE mid = $1", [msg.mid]);
    if (mineLater.length) return;
    await upsertContact(userId, {});
    await q(
      "INSERT INTO messages (ig_user_id, direction, text, mid) VALUES ($1, 'out_humano', $2, $3) ON CONFLICT (mid) DO NOTHING",
      [userId, msg.text ?? null, msg.mid],
    );
    await q(`UPDATE contacts SET paused_until = now() + $2::int * interval '1 hour' WHERE ig_user_id = $1`, [
      userId,
      HUMAN_PAUSE_HOURS,
    ]);
    return;
  }

  if (!msg || msg.is_deleted) return;
  const userId = ev.sender.id;
  if (userId === igAccountId) return;

  await upsertContact(userId, { origin: "direct", inbound: true });
  const ins = await q(
    "INSERT INTO messages (ig_user_id, direction, text, mid) VALUES ($1, 'in', $2, $3) ON CONFLICT (mid) DO NOTHING RETURNING id",
    [userId, text ?? "[anexo]", msg.mid],
  );
  if (!ins.length) return; // evento repetido

  if (text) {
    const phone = extractPhone(text);
    const email = extractEmail(text);
    if (phone || email) {
      await q(
        "UPDATE contacts SET phone = COALESCE($2, phone), email = COALESCE($3, email) WHERE ig_user_id = $1",
        [userId, phone, email],
      );
    }
  }

  const contact = (
    await q<{ paused_until: string | null; last_auto_at: string | null }>(
      "SELECT paused_until, last_auto_at FROM contacts WHERE ig_user_id = $1",
      [userId],
    )
  )[0];
  if (contact?.paused_until && new Date(contact.paused_until) > new Date()) return; // humano atendendo
  if (!text) return;

  const rule = pickRule(await loadAutomations(), "dm", text) as Automation | null;
  if (!rule) return;

  const isFallback = matchKeyword(text, rule) === "*";
  if (isFallback && contact?.last_auto_at) {
    const hours = (Date.now() - new Date(contact.last_auto_at).getTime()) / 36e5;
    if (hours < FALLBACK_COOLDOWN_HOURS) return; // evita o bot responder tudo em loop
  }

  const { text: out, addedNotice } = await withNotice(userId, rule.dm_text);
  try {
    const sent = await sendDirect(igAccountId, userId, out, quickReplyTitles(rule.quick_replies));
    await recordOutbound(userId, out, sent.message_id, addedNotice);
    await bumpHits(rule.id);
  } catch (e) {
    await log("Falha ao responder no direct", { user: userId, erro: String(e) }, "erro");
  }
}

export async function processPayload(payload: unknown) {
  const list = Array.isArray(payload) ? payload : [payload];
  for (const p of list as { object?: string; entry?: Entry[] }[]) {
    if (p?.object !== "instagram" || !Array.isArray(p.entry)) continue;
    for (const entry of p.entry) {
      try {
        const changes = entry.changes ?? (entry.field && entry.value ? [{ field: entry.field, value: entry.value }] : []);
        for (const ch of changes) {
          if (ch.field === "comments") await handleComment(entry.id, ch.value);
        }
        for (const ev of entry.messaging ?? []) await handleMessaging(entry.id, ev);
      } catch (e) {
        await log("Erro ao processar evento", { erro: String(e) }, "erro");
      }
    }
  }
}
