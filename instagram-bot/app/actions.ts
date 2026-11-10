"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { q, setSetting } from "@/lib/db";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const opt = (f: FormData, k: string) => str(f, k) || null;

export async function saveAutomation(f: FormData) {
  const id = Number(str(f, "id")) || null;
  const trigger = str(f, "trigger") === "dm" ? "dm" : "comment";
  const data = [
    str(f, "name") || "Sem nome",
    trigger,
    str(f, "keywords"),
    str(f, "match_mode") === "exact" ? "exact" : "contains",
    opt(f, "media_id"),
    str(f, "dm_text"),
    trigger === "comment" ? opt(f, "public_reply") : null,
    trigger === "dm" ? opt(f, "quick_replies") : null,
  ];
  if (!data[2] || !data[5]) throw new Error("Palavra-chave e mensagem são obrigatórias");
  if (id) {
    await q(
      `UPDATE automations SET name=$1, trigger=$2, keywords=$3, match_mode=$4, media_id=$5, dm_text=$6,
       public_reply=$7, quick_replies=$8 WHERE id=$9`,
      [...data, id],
    );
  } else {
    await q(
      `INSERT INTO automations (name, trigger, keywords, match_mode, media_id, dm_text, public_reply, quick_replies)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      data,
    );
  }
  revalidatePath("/");
  redirect("/");
}

export async function toggleAutomation(f: FormData) {
  await q("UPDATE automations SET active = NOT active WHERE id = $1", [Number(str(f, "id"))]);
  revalidatePath("/");
}

export async function deleteAutomation(f: FormData) {
  await q("DELETE FROM automations WHERE id = $1", [Number(str(f, "id"))]);
  revalidatePath("/");
}

export async function resumeBot(f: FormData) {
  await q("UPDATE contacts SET paused_until = NULL WHERE ig_user_id = $1", [str(f, "id")]);
  revalidatePath("/leads");
}

export async function pauseBot(f: FormData) {
  await q("UPDATE contacts SET paused_until = now() + interval '3650 days' WHERE ig_user_id = $1", [str(f, "id")]);
  revalidatePath("/leads");
}

export async function saveSettings(f: FormData) {
  await setSetting("aviso_privacidade", str(f, "aviso_privacidade"));
  revalidatePath("/config");
}

export async function purgeOldData(f: FormData) {
  const days = Math.max(30, Number(str(f, "days")) || 365);
  await q("DELETE FROM messages WHERE created_at < now() - $1::int * interval '1 day'", [days]);
  await q(
    `DELETE FROM contacts c WHERE COALESCE(c.last_inbound_at, c.created_at) < now() - $1::int * interval '1 day'`,
    [days],
  );
  await q("DELETE FROM event_log WHERE created_at < now() - interval '90 days'");
  revalidatePath("/config");
  revalidatePath("/leads");
}
